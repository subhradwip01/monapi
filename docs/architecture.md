# Monapi Architecture

## Overview

Monapi is a configuration-driven REST API generator for MongoDB. You define schemas, register them as resources, and monapi generates a full CRUD API with filtering, pagination, sorting, auth, hooks, and validation — all wired up automatically.

The architecture is built around two key principles:

1. **Framework-agnostic core** — Business logic (CRUD, permissions, hooks, query parsing) knows nothing about Express or Hono. Framework adapters translate between framework-native requests/responses and monapi's internal types.

2. **Schema-agnostic adapters** — The core doesn't depend on Mongoose directly. Schema adapters abstract field introspection and validation, so Typegoose (and potentially Zod/Joi/Yup) can be supported without touching CRUD logic.

---

## High-Level Flow

```
User Code                    Monapi                           MongoDB
─────────                    ──────                           ───────

const monapi = new Monapi({    ┌──────────────────┐
  connection,                  │ Monapi class      │
  framework: 'express'         │ (orchestrator)    │
})                             └────────┬─────────┘
                                        │
monapi.resource('users', {              │ resolveFrameworkAdapter()
  schema: UserSchema           ┌────────▼─────────┐
})                             │ Schema Detection  │
                               │ detectSchemaType()│
                               └────────┬─────────┘
                                        │ createSchemaAdapter()
                               ┌────────▼─────────┐
                               │ MongooseAdapter   │
                               │ or TypegooseAdapter│
                               └────────┬─────────┘
                                        │
app.use('/api', monapi.router())        │ frameworkAdapter.createRouter()
                               ┌────────▼─────────┐
         ┌─────────────────────┤ Framework Adapter │
         │                     │ (Express or Hono) │
         │                     └──────────────────┘
         │
         │  HTTP Request: GET /api/users?age__gt=18&sort=-name&page=2
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐
│ Auth Middleware  │───▶│ Permission Check │───▶│ CRUD Operation│
│ (populate user) │    │ (roles/public/fn)│    │ (list/get/...) │
└─────────────────┘    └──────────────────┘    └───────┬──────┘
                                                       │
                                          ┌────────────▼────────────┐
                                          │ Engine                  │
                                          │ ┌─────────────────────┐ │
                                          │ │ Filter Parser       │ │
                                          │ │ age__gt=18 → $gt:18 │ │
                                          │ └─────────────────────┘ │
                                          │ ┌─────────────────────┐ │
                                          │ │ Query Builder       │ │
                                          │ │ sort, page, fields  │ │
                                          │ └─────────────────────┘ │
                                          │ ┌─────────────────────┐ │
                                          │ │ Hook Executor       │ │
                                          │ │ before/after hooks  │ │
                                          │ └─────────────────────┘ │
                                          └────────────┬────────────┘
                                                       │
                                                       ▼
                                               Model.find(...)  ──▶  MongoDB
```

---

## Layer Breakdown

### 1. Orchestrator (`src/monapi.ts`)

The `Monapi` class is the entry point. It:

- Receives config (connection, framework, auth, defaults)
- Resolves the framework adapter (`ExpressAdapter` or `HonoAdapter`)
- Registers resources via `.resource(name, config)`
- For each resource: detects schema type, creates the appropriate adapter, resolves/creates the Mongoose model
- Generates the framework-specific router via `.router()`

```
Monapi.resource('users', { schema })
  └─▶ createSchemaAdapter(schema)     // auto-detect Mongoose vs Typegoose
  └─▶ resolveModel(name, config)      // get or create Model
  └─▶ store CollectionContext          // { name, model, adapter, config }

Monapi.router()
  └─▶ frameworkAdapter.createRouter(collections, options)
  └─▶ returns Express Router or Hono app
```

### 2. Schema Adapters (`src/adapters/schema/`)

Schema adapters provide a uniform interface (`SchemaAdapter`) for introspecting and validating schemas regardless of how they were defined.

```
                SchemaAdapter (interface)
               ┌─────────────────────────┐
               │ getFields()             │
               │ getFieldType(field)     │
               │ getFieldMetadata(field) │
               │ validate(data)          │
               │ getMongooseModel()      │
               │ getMongooseSchema()     │
               └────────┬────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
   ┌────────▼────────┐    ┌────────▼─────────┐
   │ MongooseAdapter  │    │ TypegooseAdapter  │
   │                  │    │                   │
   │ Wraps Schema or  │    │ Calls             │
   │ Model directly   │    │ getModelForClass() │
   └──────────────────┘    │ then delegates to  │
                           │ MongooseAdapter    │
                           └───────────────────┘
```

**Detection logic** (`detectSchemaType`):

| Input | Detection method | Result |
|-------|-----------------|--------|
| `instanceof Schema` | Direct check | `Mongoose` |
| Function with `.schema` property | Model check | `Mongoose` |
| Class with `Reflect.getMetadata('typegoose:properties')` | Reflect metadata | `Typegoose` |
| Anything else | — | `Unknown` (throws) |

**TypegooseAdapter internals**: Composition, not inheritance. The constructor calls `getModelForClass(cls)` once, passes the resulting Model to a `MongooseAdapter`, and every method just calls `this.inner.<method>()`.

### 3. Framework Adapters (`src/adapters/framework/`)

Framework adapters implement the `FrameworkAdapter` interface:

```ts
interface FrameworkAdapter {
  name: string
  createRouter(collections, options): any      // build routes
  wrapHandler(handler: MonapiHandler): any     // convert to native handler
  createErrorHandler(logger?): any             // framework error middleware
}
```

Each adapter:

1. **Converts** framework-native request/response → `MonapiRequest`/`MonapiResponse`
2. **Builds** per-collection routers with middleware stacks:
   - Auth middleware (skipped for `'public'` operations)
   - Collection-wide custom middleware
   - Per-operation custom middleware
   - Permission check
   - CRUD handler
3. **Maps** operations to HTTP verbs:

| Operation | HTTP | Route |
|-----------|------|-------|
| list | GET | `/:collection` |
| get | GET | `/:collection/:id` |
| create | POST | `/:collection` |
| update | PUT | `/:collection/:id` |
| patch | PATCH | `/:collection/:id` |
| delete | DELETE | `/:collection/:id` |

### 4. Core CRUD Operations (`src/core/crud-operations.ts`)

Pure functions, completely framework-agnostic. Each takes `(MonapiRequest, MonapiResponse, OperationOptions)` and returns `OperationResult { statusCode, data, meta? }`.

Every operation follows the same lifecycle:

```
1. Parse/validate input
2. Run beforeX hook (mutable context)
3. If ctx.preventDefault → return early
4. Execute MongoDB operation
5. Run afterX hook (mutable context)
6. Return OperationResult
```

| Function | MongoDB operation | Notes |
|----------|------------------|-------|
| `listDocuments` | `find()` + `countDocuments()` | Parallel queries, builds pagination meta |
| `getDocument` | `findById()` | Supports field projection |
| `createDocument` | `create()` | Validates via adapter first |
| `updateDocument` | `findByIdAndUpdate(overwrite)` | Full replace, validates first |
| `patchDocument` | `findByIdAndUpdate($set)` | Partial update, blocks `$` operators |
| `deleteDocument` | `findByIdAndDelete()` | — |

### 5. Permission Checker (`src/core/permission-checker.ts`)

Framework-agnostic permission evaluation:

```
Permission value         Behavior
────────────────         ────────
'public'              →  Skip auth + permission check entirely
['admin', 'editor']   →  Require user with matching role
(ctx) => boolean      →  Custom function, full context access
undefined/missing     →  Allow (no restriction)
```

The checker throws `UnauthorizedError` (401) if no user is present, or `ForbiddenError` (403) if the user lacks the required role.

### 6. Engine (`src/engine/`)

The query processing pipeline:

```
Query params: ?age__gt=18&role=admin&sort=-name&page=2&limit=20&fields=name,email
                │
                ▼
        ┌───────────────┐
        │ Filter Parser │  age__gt=18   → { age: { $gt: 18 } }
        │               │  role=admin   → { role: 'admin' }
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │ Query Builder │  sort=-name   → { name: -1 }
        │               │  page=2       → skip: 20, limit: 20
        │               │  fields=...   → { name: 1, email: 1 }
        └───────┬───────┘
                │
                ▼
        MongoQuery { filter, sort, skip, limit, projection }
```

**Filter parser** supports three syntaxes:
- Simple: `?role=admin` (equality)
- Operator: `?age__gt=18` (10 operators: eq, ne, gt, gte, lt, lte, in, nin, like, exists)
- Bracket: `?filter[age][gt]=18`

**Auto type coercion**: `"25"` → number, `"true"` → boolean, ISO strings → Date. When a schema adapter is available, coercion is field-type-aware.

**Security enforcements**:
- `$` prefix blocked in field names, sort, projection, patch bodies
- Field whitelist via `allowedFilters` / `allowedSorts`
- Operator whitelist (only the 10 known operators)
- Regex length limit for `__like`
- Max filter count (default 20)

### 7. Lifecycle Hooks (`src/engine/hook-executor.ts`)

Hooks receive a mutable `HookContext` and can:
- Modify `ctx.data` (change request body before write)
- Modify `ctx.query` (inject filters before read)
- Set `ctx.preventDefault = true` (skip the default operation, send custom response)
- Read `ctx.result` (in after-hooks)

```
Available hooks:
  beforeFind   afterFind
  beforeCreate afterCreate
  beforeUpdate afterUpdate
  beforeDelete afterDelete
```

### 8. Error Handling (`src/utils/errors.ts`)

Custom error hierarchy:

```
MonapiError (base)
├── NotFoundError       404  NOT_FOUND
├── ValidationError     400  VALIDATION_ERROR
├── BadRequestError     400  BAD_REQUEST
├── UnauthorizedError   401  UNAUTHORIZED
└── ForbiddenError      403  FORBIDDEN
```

Framework adapters catch these and produce structured JSON responses:
```json
{ "error": { "code": "NOT_FOUND", "message": "users with id '123' not found" } }
```

In production (`NODE_ENV=production`), generic errors hide internal details.

---

## Directory Structure

```
src/
├── index.ts                              # Public API exports
├── monapi.ts                             # Orchestrator class
├── core/
│   ├── types.ts                          # MonapiRequest, MonapiResponse, FrameworkAdapter
│   ├── crud-operations.ts                # Framework-agnostic CRUD logic
│   └── permission-checker.ts             # Auth & role checking
├── engine/
│   ├── filter-parser.ts                  # Query params → MongoDB filter
│   ├── query-builder.ts                  # Full query (sort, page, projection)
│   └── hook-executor.ts                  # Lifecycle hook runner
├── adapters/
│   ├── schema/
│   │   ├── MongooseAdapter.ts            # Mongoose Schema/Model adapter
│   │   ├── TypegooseAdapter.ts           # Typegoose class adapter
│   │   └── index.ts                      # Detection & factory
│   └── framework/
│       ├── express.ts                    # Express adapter
│       ├── hono.ts                       # Hono adapter
│       └── index.ts                      # Adapter factory
├── types/
│   ├── config.ts                         # MonapiConfig, CollectionConfig
│   ├── query.ts                          # Filter, query, pagination types
│   ├── schema.ts                         # SchemaAdapter interface, SchemaType
│   ├── auth.ts                           # Permission types
│   ├── hooks.ts                          # Hook types
│   └── index.ts                          # Barrel re-export
├── middleware/
│   ├── auth.ts                           # Legacy Express auth middleware
│   └── error-handler.ts                  # Express error middleware
└── utils/
    ├── errors.ts                         # Error classes
    └── logger.ts                         # Default console logger
```

---

## Extension Points

### Adding a new framework adapter

1. Create `src/adapters/framework/fastify.ts`
2. Implement `FrameworkAdapter` interface (4 methods)
3. Add case to `resolveFrameworkAdapter()` in `src/adapters/framework/index.ts`

No changes needed to CRUD logic, hooks, permissions, or query parsing.

### Adding a new schema adapter

1. Create `src/adapters/schema/ZodAdapter.ts`
2. Implement `SchemaAdapter` interface (6 methods)
3. Add detection logic to `detectSchemaType()` in `src/adapters/schema/index.ts`
4. Add to `SchemaType` enum in `src/types/schema.ts`

No changes needed to CRUD logic, framework adapters, or engine.

### Adding a new filter operator

1. Add to `OPERATOR_MAP` in `src/engine/filter-parser.ts`
2. Add to `FilterOperator` type in `src/types/query.ts`
3. Handle coercion if needed in `coerceValue()`

---

## Design Decisions

**Composition over inheritance** — TypegooseAdapter wraps MongooseAdapter via composition rather than extending it. This keeps the Typegoose dependency completely isolated; if `getModelForClass()` changes, only one file needs updating.

**Dynamic requires for optional deps** — Typegoose and Hono are loaded via `require()` at runtime, not static imports. This means they're truly optional — users who don't install them pay zero cost.

**Framework-agnostic types** — `MonapiRequest` and `MonapiResponse` are plain interfaces, not tied to Express or Hono. This makes the CRUD operations testable without any HTTP framework.

**Parallel queries** — `listDocuments` runs `find()` and `countDocuments()` in parallel via `Promise.all`, avoiding sequential roundtrips.

**Mutable hook context** — Hooks mutate the context object rather than returning new values. This keeps the hook API simple (no return type juggling) and allows hooks to modify query/data in-place.

**Error hierarchy with `setPrototypeOf`** — Custom error classes use `Object.setPrototypeOf` to ensure `instanceof` works correctly with TypeScript's class compilation.
