# Monapi - File Reference

> Total: 3,104 lines of source code + 1,305 lines of tests = 4,409 lines

---

## Root Config Files

| File | Purpose |
|------|---------|
| `package.json` | npm package manifest. Defines name (`monapi`), version, scripts, dependencies (mongoose), peer dependencies (express/hono, mongoose), dev dependencies (TypeScript, Jest, ESLint, tsup). Exports CJS, ESM, and type declarations. |
| `tsconfig.json` | TypeScript configuration. Targets ES2020, strict mode enabled, outputs to `dist/`. Includes all `src/**/*`, excludes tests and node_modules. |
| `tsup.config.ts` | Build configuration using tsup. Bundles `src/index.ts` into CJS (`.js`) and ESM (`.mjs`) formats with TypeScript declarations (`.d.ts`). Tree-shakable, externals: mongoose + express + hono. |
| `jest.config.js` | Test runner config. Uses `ts-jest` preset, looks for tests in `src/` and `tests/` directories, collects coverage from `src/**/*.ts`. |
| `.eslintrc.js` | ESLint config with TypeScript parser and Prettier integration. |
| `.prettierrc` | Code formatting rules (single quotes, no semicolons, trailing commas, 100 char width). |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `coverage/`, `.env`, OS files. |
| `crud.md` | Original project specification / requirements document. Describes all features monapi must support. |

---

## Source Code (`src/` - 3,104 lines)

### Entry Points

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 107 | **Public API barrel.** Re-exports everything consumers need: `Monapi` class, core types (`MonapiRequest`, `MonapiResponse`, `FrameworkAdapter`), CRUD operations, permission checker, all TypeScript types/interfaces, schema adapters, framework adapters (`ExpressAdapter`, `HonoAdapter`), error classes, and engine utilities (`parseFilters`, `buildQuery`). |
| `src/monapi.ts` | 135 | **Main orchestrator class.** The `Monapi` class is the primary user-facing API. Users call `resource(name, config)` to register MongoDB collections, then `router()` to get a framework-specific router with all CRUD routes auto-generated. Accepts `framework: 'express' | 'hono'` to select the adapter. Handles model resolution (auto-creates Mongoose models from schemas), adapter creation, auth middleware setup, and router mounting. |

### Core Abstractions (`src/core/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/core/types.ts` | 115 | **Framework-agnostic type definitions.** Defines `MonapiRequest` (params, query, body, headers, method, path, user, raw), `MonapiResponse` (status, json, setHeader, raw), `MonapiHandler`, `OperationResult` (statusCode, data, meta), `CollectionContext` (name, model, adapter, config, defaults, logger), and `FrameworkAdapter` interface (name, createRouter, wrapHandler, createErrorHandler). Also defines `BuiltinFramework = 'express' | 'hono'`. |
| `src/core/crud-operations.ts` | 281 | **Pure CRUD business logic.** Framework-agnostic functions: `listDocuments` (find with filters/sort/pagination/projection + parallel count query), `getDocument` (findById), `createDocument` (validate + save + 201), `updateDocument` (validate + findByIdAndUpdate with overwrite), `patchDocument` (findByIdAndUpdate with $set, blocks `$` operators), `deleteDocument` (findByIdAndDelete). All run lifecycle hooks, support `preventDefault`, and return `OperationResult { statusCode, data, meta }`. |
| `src/core/permission-checker.ts` | 68 | **Framework-agnostic permission checking.** `checkPermissions()` takes a `MonapiRequest` and evaluates permissions: `'public'` skips auth entirely, `string[]` checks user roles, custom functions get full `PermissionContext`. Throws `UnauthorizedError` (401) or `ForbiddenError` (403). Maps route operations (list, get) to CRUD operations (find). |

### Type Definitions (`src/types/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/config.ts` | 155 | **Core configuration types.** Defines `MonapiConfig` (top-level config with connection, framework, basePath, auth, defaults), `CollectionConfig` (per-collection settings: schema, handlers, hooks, middleware, permissions, query config), `DefaultConfig` (pagination/security defaults), `Handler`, `CRUDHandlers`, `MiddlewareConfig`, `Logger`, `ListResponse`, `SingleResponse`, `ErrorResponse`. |
| `src/types/query.ts` | 88 | **Query & filter types.** Defines `FilterOperator` (eq, ne, gt, gte, lt, lte, in, nin, like, exists), `FilterCondition`, `ParsedFilters`, `QueryOptions`, `MongoQuery` (the final MongoDB query object with filter/sort/skip/limit/projection), `PaginationMeta`, `QueryConfig` (allowedFilters, allowedSorts, defaultSort, limits), `FieldType` enum (String, Number, Boolean, Date, ObjectId, Array, Object, Mixed). |
| `src/types/schema.ts` | 93 | **Schema adapter interface.** Defines the `SchemaAdapter` interface that all schema types must implement: `getFields()`, `getFieldType()`, `getFieldMetadata()`, `getAllFieldsMetadata()`, `validate()`, optional `getMongooseModel()` and `getMongooseSchema()`. Also defines `ValidationResult`, `ValidationError`, `FieldMetadata`, `SchemaType` enum (Mongoose, Typegoose, Zod, Joi, Yup), `SchemaOptions`. |
| `src/types/auth.ts` | 77 | **Auth & permission types.** Defines `PermissionContext` (user, collection, operation, data, request), `PermissionFunction`, `Permission` (`'public'` | `string[]` for roles | custom function), `PermissionConfig` (per-operation permissions), `FieldPermission`, `FieldPermissions`, `AuthMiddleware`, `AuthConfig` (custom middleware, JWT settings). |
| `src/types/hooks.ts` | 84 | **Lifecycle hook types.** Defines `CRUDOperation` ('find', 'create', 'update', 'patch', 'delete'), `User` (id + roles), `HookContext` (mutable context passed to hooks with collection, operation, user, query, data, result, req, res, meta, preventDefault), `HookFunction`, `LifecycleHooks` (beforeFind, afterFind, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete), `HookEntry`. |
| `src/types/index.ts` | 6 | **Barrel re-export.** Re-exports all types from auth, config, hooks, query, schema. |

### Schema Adapters (`src/adapters/schema/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/adapters/schema/MongooseAdapter.ts` | 212 | **Mongoose schema adapter.** Implements `SchemaAdapter` for Mongoose Schema and Model objects. Extracts field names (excluding `_id`, `__v`), maps Mongoose types to `FieldType` enum, reads field metadata (required, default, enum), validates data using Mongoose's built-in validation (or basic object check if no model). Accepts either a Schema or Model in the constructor. |
| `src/adapters/schema/index.ts` | 82 | **Schema detection & factory.** `detectSchemaType()` auto-detects whether a schema is Mongoose, Typegoose, Zod, Joi, or Yup by checking for type-specific markers (instanceof Schema, `_def`+`parse` for Zod, `isJoi`, `__isYupSchema__`, Reflect metadata for Typegoose). `createSchemaAdapter()` creates the right adapter (currently only Mongoose implemented). `isSupportedSchema()` checks if a schema type is recognized. |

### Framework Adapters (`src/adapters/framework/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/adapters/framework/express.ts` | 189 | **Express framework adapter.** Implements `FrameworkAdapter` for Express. `toMonapiRequest()` / `toMonapiResponse()` convert Express req/res to framework-agnostic types. `buildCollectionRouter()` creates per-collection Express Router with middleware stacks per operation: auth middleware (skipped for `'public'` ops) → collection-wide middleware → per-operation middleware → permission check → CRUD handler. `handleOp()` calls core CRUD operations and sends responses. `createErrorHandler()` provides Express error middleware. |
| `src/adapters/framework/hono.ts` | 206 | **Hono framework adapter.** Implements `FrameworkAdapter` for Hono (works on Bun, Deno, Cloudflare Workers, Node). Dynamically requires Hono at runtime. `toMonapiRequest()` / `toMonapiResponse()` convert Hono context. Auth middleware is applied per-route (not globally) so `'public'` operations can skip it. Body is parsed asynchronously with `c.req.json()`. Uses `c.get('user')` for user context. |
| `src/adapters/framework/index.ts` | 29 | **Adapter factory.** `resolveFrameworkAdapter()` accepts `'express'`, `'hono'`, or a custom `FrameworkAdapter` object and returns the appropriate adapter instance. Defaults to Express. |

### Engine (`src/engine/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/engine/filter-parser.ts` | 256 | **Query parameter to MongoDB filter converter.** The core filtering engine. Supports 3 modes: (1) Simple equality `?age=25`, (2) Double-underscore operators `?age__gt=18&age__lt=29`, (3) Advanced bracket syntax `?filter[age][gt]=18`. Maps operators to MongoDB: eq→$eq, gt→$gt, in→$in, like→$regex, etc. Auto-coerces types (strings to numbers, booleans, dates). Security: field whitelist validation, operator whitelist, regex length limits, max filter count, blocks `$` prefixed fields. |
| `src/engine/query-builder.ts` | 192 | **Full MongoDB query builder.** Takes query params and builds a complete `MongoQuery` object. Calls `parseFilters()` for the filter, then parses: sort (`?sort=age,-createdAt` → `{age: 1, createdAt: -1}`), pagination (`?page=2&limit=20` → skip/limit with max enforcement), field projection (`?fields=name,email` → `{name: 1, email: 1}`). Also exports `buildPaginationMeta()` for response metadata and `extractPagination()` helper. |
| `src/engine/crud-handlers.ts` | 355 | **Legacy Express CRUD handler factory.** Original Express-specific handler factory kept for backward compatibility. `createCRUDHandlers()` generates 6 Express handlers. Superseded by `src/core/crud-operations.ts` for new code. |
| `src/engine/hook-executor.ts` | 61 | **Lifecycle hook runner.** `createHookContext()` builds a `HookContext` from request params (collection, operation, user, data, id, query). `executeHook()` runs a specific hook function if it exists, logs errors, and returns the (possibly mutated) context. Supports both sync and async hooks. |

### Router (`src/router/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/router/express-router.ts` | 67 | **Legacy Express router generator.** Original Express-specific router kept for backward compatibility. Superseded by `src/adapters/framework/express.ts`. |

### Middleware (`src/middleware/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/middleware/auth.ts` | 106 | **Legacy Express auth middleware.** `createPermissionMiddleware()` and `createAuthMiddleware()` for Express. Superseded by `src/core/permission-checker.ts` for new code. |
| `src/middleware/error-handler.ts` | 42 | **Express error handling middleware.** `createErrorHandler()` returns Express error middleware. For `MonapiError` subclasses, responds with the correct status code + structured error JSON. For unknown errors, responds 500 with message hidden in production (no stack trace leaks). |

### Utilities (`src/utils/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/errors.ts` | 58 | **Custom error classes.** Base `MonapiError` extends Error with `statusCode`, `code`, `details`. Subclasses: `NotFoundError` (404), `ValidationError` (400), `ForbiddenError` (403), `UnauthorizedError` (401), `BadRequestError` (400). All use `Object.setPrototypeOf` for correct instanceof checks. |
| `src/utils/logger.ts` | 21 | **Default logger.** Simple console-based logger implementing the `Logger` interface. Prefixes all messages with `[monapi]`. Debug messages suppressed in production (`NODE_ENV=production`). |

---

## Tests (`tests/` - 1,305 lines, 155 tests)

| File | Lines | Tests | What it covers |
|------|-------|-------|----------------|
| `tests/unit/filter-parser.test.ts` | 227 | 32 | Simple equality, skipping empty/reserved params, auto type coercion (number, boolean, date), type-aware coercion with adapter, all 10 double-underscore operators, combining operators on same field, advanced bracket syntax, security ($ injection, field whitelist, operator whitelist, regex length, regex escaping, max filter count). |
| `tests/unit/query-builder.test.ts` | 199 | 28 | Filter passthrough, reserved param exclusion, ascending/descending/multi sort, defaultSort, sort validation, pagination defaults/parsing/capping/custom limits, projection parsing/validation/trimming, full combined query, `buildPaginationMeta` (rounding, zero), `extractPagination`. |
| `tests/unit/mongoose-adapter.test.ts` | 156 | 19 | Field listing (includes/excludes), type detection for all 7 types, field metadata (required, enum, undefined), getAllFieldsMetadata, validation (invalid type, valid object, null), schema/model getters, construction from Model. |
| `tests/unit/hook-executor.test.ts` | 162 | 9 | Context creation with all properties, user extraction, hook execution, no-op for missing hooks, context mutation by hooks, async hook support, error propagation, error logging. |
| `tests/unit/auth-middleware.test.ts` | 117 | 12 | No permissions (allow all), missing operation permission, no user (401), wrong role (403), correct role (allow), multiple roles, custom permission functions (allow/deny), no roles array, createAuthMiddleware with/without custom middleware. |
| `tests/unit/error-handler.test.ts` | 105 | 5 | MonapiError with status code, ValidationError with details, generic Error (500), production error hiding, logger integration. |
| `tests/unit/errors.test.ts` | 84 | 9 | All 6 error classes: properties, status codes, codes, details, default messages, custom messages, instanceof chain. |
| `tests/unit/schema-detection.test.ts` | 70 | 11 | Mongoose Schema detection, plain object/null/undefined/string (Unknown), Zod-like/Joi-like/Yup-like detection, adapter creation for Mongoose, throw for unsupported/Zod, `isSupportedSchema`. |
| `tests/unit/core-permission-checker.test.ts` | 102 | 10 | No permissions (allow all), missing operation permission, no user (401), wrong role (403), correct role, custom permission functions, public permission without user, public with user present, mixed public + role-based permissions. |
| `tests/unit/framework-adapters.test.ts` | 83 | 12 | Adapter resolution (default/express/hono/unknown/custom), ExpressAdapter (name, createRouter, wrapHandler, createErrorHandler), HonoAdapter (name, wrapHandler, createErrorHandler). |

---

## Examples (`examples/`)

| File | Purpose |
|------|---------|
| `examples/basic-usage.ts` | Full working example showing how to use monapi: connects to MongoDB, defines User and Post schemas, creates Monapi instance with defaults, registers resources with query config/hooks/permissions, mounts router on Express, logs all available endpoints and query examples. |

---

## Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `docs/progress.md` | Build progress tracker. Tracks all phases with checkboxes, architecture diagram, file list. Updated after each session. |
| `docs/files.md` | This file. Explains every file in the project. |

---

## Architecture

```
src/
  index.ts                          # Main entry + public API exports
  monapi.ts                         # Orchestrator (framework-agnostic)
  core/
    types.ts                        # MonapiRequest, MonapiResponse, FrameworkAdapter
    crud-operations.ts              # Pure CRUD business logic
    permission-checker.ts           # Framework-agnostic auth (supports 'public')
  engine/
    filter-parser.ts                # Query param → MongoDB filter
    query-builder.ts                # Full query construction (sort, page, fields)
    crud-handlers.ts                # Legacy Express handlers
    hook-executor.ts                # Lifecycle hook runner
  adapters/
    schema/
      MongooseAdapter.ts            # Mongoose schema/model adapter
      index.ts                      # Schema detection & factory
    framework/
      express.ts                    # Express adapter
      hono.ts                       # Hono adapter (Bun/Deno/Workers/Node)
      index.ts                      # Adapter factory
  types/
    config.ts                       # MonapiConfig, CollectionConfig
    query.ts                        # Filter, query, pagination types
    schema.ts                       # SchemaAdapter interface
    auth.ts                         # Permission, auth types
    hooks.ts                        # Lifecycle hooks, context types
    index.ts                        # Barrel re-export
  router/
    express-router.ts               # Legacy Express router
  middleware/
    auth.ts                         # Legacy Express auth middleware
    error-handler.ts                # Express error middleware
  utils/
    errors.ts                       # Custom error classes
    logger.ts                       # Default logger
tests/
  unit/
    filter-parser.test.ts           # 32 tests
    query-builder.test.ts           # 28 tests
    mongoose-adapter.test.ts        # 19 tests
    schema-detection.test.ts        # 11 tests
    errors.test.ts                  # 9 tests
    error-handler.test.ts           # 5 tests
    hook-executor.test.ts           # 9 tests
    auth-middleware.test.ts         # 12 tests
    core-permission-checker.test.ts # 10 tests
    framework-adapters.test.ts      # 12 tests (express + hono adapters)
examples/
  basic-usage.ts
```
