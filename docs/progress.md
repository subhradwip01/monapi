# Monapi - Build Progress

## Phase 1: Foundation (COMPLETED)
- [x] Project scaffolding (package.json, tsconfig, tsup, eslint, prettier, jest)
- [x] TypeScript type definitions
  - `src/types/config.ts` - MonapiConfig, CollectionConfig, DefaultConfig, Logger, Response types
  - `src/types/query.ts` - FilterOperator, QueryOptions, MongoQuery, PaginationMeta, QueryConfig, FieldType
  - `src/types/schema.ts` - SchemaAdapter interface, ValidationResult, FieldMetadata, SchemaType enum
  - `src/types/auth.ts` - PermissionConfig, AuthConfig, FieldPermissions
  - `src/types/hooks.ts` - LifecycleHooks, HookContext, HookFunction, CRUDOperation
  - `src/types/index.ts` - Re-export barrel
- [x] Mongoose Schema Adapter (`src/adapters/schema/MongooseAdapter.ts`)
  - Field extraction, type detection, metadata, validation
- [x] Schema detection & adapter factory (`src/adapters/schema/index.ts`)
  - Auto-detect Mongoose/Zod/Joi/Yup/Typegoose schemas

## Phase 2: Core Engine (COMPLETED)
- [x] Filter Parser (`src/engine/filter-parser.ts`)
  - Simple mode: `?age=25&role=admin`
  - Operator mode: `?age__gt=18&age__lt=29`
  - Advanced mode: `?filter[age][gt]=18`
  - Security: field whitelist, operator whitelist, regex limits, max filter count
  - Auto type coercion (number, boolean, date, string)
- [x] Query Builder (`src/engine/query-builder.ts`)
  - Sort parsing (`?sort=age,-createdAt`)
  - Pagination (`?page=2&limit=20`) with max limit enforcement
  - Field projection (`?fields=name,email`)
  - Pagination meta builder (page, limit, total, totalPages)
- [x] Error Utilities (`src/utils/errors.ts`)
  - MonapiError, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError, BadRequestError
- [x] Error Handler Middleware (`src/middleware/error-handler.ts`)
  - Safe production error responses, no stack trace leaks
- [x] Default Logger (`src/utils/logger.ts`)

## Phase 3: Express Integration (COMPLETED)
- [x] CRUD Handler Factory (`src/engine/crud-handlers.ts`)
  - list (GET /), get (GET /:id), create (POST /), update (PUT /:id), patch (PATCH /:id), delete (DELETE /:id)
  - Full hook integration (beforeFind/afterFind, beforeCreate/afterCreate, etc.)
  - Validation on create/update, operator blocking on patch
  - Standardized responses: `{ data: [], meta: { page, limit, total } }` and `{ data: {} }`
- [x] Hook Executor (`src/engine/hook-executor.ts`)
  - Context creation, hook execution with error handling, preventDefault support
- [x] Auth Middleware (`src/middleware/auth.ts`)
  - Permission middleware (role-based + custom functions)
  - Auth middleware factory (custom or no-op)
- [x] Express Router Generator (`src/router/express-router.ts`)
  - Route registration with middleware stacks per operation
  - Supports global auth, per-collection middleware, per-operation middleware, permission checks
- [x] Main Monapi Class (`src/monapi.ts`)
  - `resource(name, config)` to register collections
  - `router()` to generate Express router
  - Auto model resolution from Schema/Model/Adapter
- [x] Entry Point (`src/index.ts`)
  - Exports: Monapi class, all types, adapters, errors, engine utilities

## Phase 4: Verification (COMPLETED)
- [x] TypeScript compiles with zero errors (`tsc --noEmit`)
- [x] Package builds successfully (`tsup` - CJS + ESM + DTS)
- [x] Example usage (`examples/basic-usage.ts`)

## Phase 5: Testing (COMPLETED - 133 tests, 8 suites)
- [x] `tests/unit/filter-parser.test.ts` - 32 tests (equality, operators, bracket syntax, coercion, security)
- [x] `tests/unit/query-builder.test.ts` - 28 tests (sort, pagination, projection, full query)
- [x] `tests/unit/mongoose-adapter.test.ts` - 19 tests (fields, types, metadata, validation)
- [x] `tests/unit/schema-detection.test.ts` - 11 tests (detection, factory, supported check)
- [x] `tests/unit/errors.test.ts` - 9 tests (all error classes)
- [x] `tests/unit/error-handler.test.ts` - 5 tests (error middleware, production mode)
- [x] `tests/unit/hook-executor.test.ts` - 9 tests (context, execution, async, errors)
- [x] `tests/unit/auth-middleware.test.ts` - 12 tests (permissions, roles, custom functions)

## Phase 6: Polish (COMPLETED)
- [x] `README.md` - Full documentation (install, quickstart, filtering, sorting, pagination, hooks, auth, permissions, middleware, custom handlers, security, API reference)
- [x] `LICENSE` - MIT license
- [x] `docs/files.md` - Detailed explanation of every file in the project
- [x] npm publish prep - clean `files` config (9 files, 55.5 kB packed), peerDependencies for express+mongoose, `prepublishOnly` script
- [ ] Zod/Joi/Yup adapter implementations (future)

---

## Phase 7: Framework-Agnostic Refactor (PLANNED - Next Session)

### Problem
monapi v0.1.0 is tightly coupled to Express. These files directly import Express types:
- `src/engine/crud-handlers.ts` - handlers use `(req: Request, res: Response, next: NextFunction)`
- `src/router/express-router.ts` - creates Express `Router`
- `src/middleware/auth.ts` - uses Express middleware signature
- `src/middleware/error-handler.ts` - Express error middleware `(err, req, res, next)`
- `src/engine/hook-executor.ts` - puts Express `req`/`res` into HookContext
- `src/types/config.ts` - imports Express types for Handler, MiddlewareConfig
- `src/types/auth.ts` - imports Express types for AuthMiddleware
- `src/types/hooks.ts` - imports Express types for HookContext

### Goal
Make monapi work with **any** Node.js framework: Express, Fastify, NestJS, Hono, Koa, Bun.serve — while keeping Express as the default and maintaining backward compatibility.

### What's Already Framework-Agnostic (no changes needed)
- `src/engine/filter-parser.ts` - pure function, takes plain objects, returns MongoDB filter
- `src/engine/query-builder.ts` - pure function, takes plain objects, returns MongoQuery
- `src/adapters/schema/*` - Mongoose only, no framework dependency
- `src/utils/errors.ts` - plain error classes
- `src/utils/logger.ts` - plain console logger
- `src/types/query.ts` - no framework imports
- `src/types/schema.ts` - no framework imports

### Target Frameworks (v0.2.0)
1. **Express** (done - default adapter)
2. **Hono** (done - works on Bun/Deno/Cloudflare Workers/Node)

### Future Frameworks (open-source contributions welcome)
3. **Fastify**
4. **NestJS**
5. **Koa**
6. **Bun.serve**

### Implementation Plan

#### Step 1: Define Framework-Agnostic Request/Response Abstraction
Create `src/core/types.ts` with framework-neutral interfaces:

```ts
interface MonapiRequest {
  params: Record<string, string>     // URL params (:id)
  query: Record<string, any>         // Query string
  body: any                          // Request body
  headers: Record<string, string>    // Headers
  method: string                     // GET, POST, etc.
  path: string                       // URL path
  user?: any                         // Auth user (set by auth middleware)
  raw: any                           // Original framework request (for hooks)
}

interface MonapiResponse {
  status(code: number): MonapiResponse
  json(data: any): void
  setHeader(key: string, value: string): MonapiResponse
  raw: any                           // Original framework response (for hooks)
}
```

#### Step 2: Extract Core CRUD Logic from Express Handlers
Create `src/core/crud-operations.ts` — pure business logic functions:

```ts
// These take MonapiRequest and return plain data objects
// No framework types, no res.json() calls
async function listDocuments(model, query, options): Promise<{ data, meta }>
async function getDocument(model, id, options): Promise<{ data }>
async function createDocument(model, data, adapter, options): Promise<{ data, statusCode }>
async function updateDocument(model, id, data, adapter, options): Promise<{ data }>
async function patchDocument(model, id, data, options): Promise<{ data }>
async function deleteDocument(model, id, options): Promise<{ data }>
```

#### Step 3: Create Framework Adapter Interface
Create `src/adapters/framework/types.ts`:

```ts
interface FrameworkAdapter {
  name: string
  createRouter(collections: Map<string, CollectionConfig>): any  // framework-specific router
  wrapHandler(fn: MonapiHandler): any                            // convert to framework handler
  extractRequest(rawReq: any): MonapiRequest                     // framework req -> MonapiRequest
  sendResponse(rawRes: any, statusCode: number, data: any): void // send JSON response
  createErrorHandler(logger?: Logger): any                       // framework error middleware
}
```

#### Step 4: Implement Express Adapter (refactor existing code)
Move current Express-specific code to `src/adapters/framework/express.ts`:
- Wraps core CRUD operations into Express `(req, res, next)` handlers
- Creates Express Router
- Maps Express req/res to MonapiRequest/MonapiResponse

#### Step 5: Implement Fastify Adapter
Create `src/adapters/framework/fastify.ts`:
- Registers Fastify routes with schemas
- Maps Fastify request/reply to MonapiRequest/MonapiResponse
- Uses Fastify's built-in validation and serialization

#### Step 6: Implement Hono Adapter
Create `src/adapters/framework/hono.ts`:
- Works on Bun, Deno, Cloudflare Workers, Node
- Maps Hono's `c.req` / `c.json()` to MonapiRequest/MonapiResponse

#### Step 7: Update Monapi Class
Refactor `src/monapi.ts` to accept a framework adapter:

```ts
// Express (default - backward compatible)
const monapi = new Monapi({ connection, framework: 'express' })
app.use('/api', monapi.router())

// Fastify
const monapi = new Monapi({ connection, framework: 'fastify' })
monapi.register(fastifyApp, { prefix: '/api' })

// Hono
const monapi = new Monapi({ connection, framework: 'hono' })
honoApp.route('/api', monapi.router())

// Or bring your own adapter
const monapi = new Monapi({ connection, framework: customAdapter })
```

#### Step 8: Update Hook Context
Refactor HookContext to use MonapiRequest/MonapiResponse instead of Express types, but keep `raw` references to the original framework objects for advanced users.

#### Step 9: Subpath Exports for Tree-Shaking
Update package.json exports so users only import what they need:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./express": "./dist/adapters/framework/express.js",
    "./fastify": "./dist/adapters/framework/fastify.js",
    "./hono": "./dist/adapters/framework/hono.js"
  }
}
```

#### Step 10: Tests and Examples per Framework
- Unit tests for core CRUD operations (framework-independent)
- Integration tests per adapter (Express, Fastify, Hono)
- Example files: `examples/express.ts`, `examples/fastify.ts`, `examples/hono.ts`

### New Architecture After Refactor

```
src/
  index.ts                          # Main entry + public API
  monapi.ts                         # Orchestrator (framework-agnostic)
  core/
    types.ts                        # MonapiRequest, MonapiResponse
    crud-operations.ts              # Pure CRUD business logic
    hook-executor.ts                # Framework-agnostic hooks
    permission-checker.ts           # Framework-agnostic auth
  engine/
    filter-parser.ts                # (unchanged)
    query-builder.ts                # (unchanged)
  adapters/
    schema/                         # (unchanged)
      MongooseAdapter.ts
      index.ts
    framework/
      types.ts                      # FrameworkAdapter interface
      express.ts                    # Express adapter
      fastify.ts                    # Fastify adapter
      hono.ts                       # Hono adapter
      index.ts                      # Auto-detection + factory
  types/                            # (updated - remove Express imports)
  utils/                            # (unchanged)
```

### Breaking Changes to Manage
- HookContext `req`/`res` will become `MonapiRequest`/`MonapiResponse` (with `.raw` for original)
- `MiddlewareConfig` will change from Express RequestHandler[] to a generic type
- `Handler` type will change signature
- **Mitigation**: v0.2.0 release with migration guide, Express adapter keeps same DX

### Estimated Work
- Step 1-2: Core abstraction (~2 hours)
- Step 3-4: Express adapter refactor (~1 hour)
- Step 5: Fastify adapter (~1 hour)
- Step 6: Hono adapter (~1 hour)
- Step 7-8: Monapi class + hooks update (~1 hour)
- Step 9-10: Exports, tests, examples (~2 hours)

---

## Architecture

```
src/
  index.ts                    # Main entry point & public API exports
  monapi.ts                   # Monapi class (orchestrator)
  types/                      # TypeScript interfaces
    config.ts                 # Main config, handlers, middleware, response types
    query.ts                  # Filter, query, pagination types
    schema.ts                 # SchemaAdapter, validation, field metadata
    auth.ts                   # Permission, auth config types
    hooks.ts                  # Lifecycle hooks, context types
    index.ts                  # Re-export barrel
  adapters/schema/            # Schema adapters
    MongooseAdapter.ts        # Mongoose schema/model adapter
    index.ts                  # Detection & factory
  engine/
    filter-parser.ts          # Query param -> MongoDB filter
    query-builder.ts          # Full query construction (sort, page, fields)
    crud-handlers.ts          # CRUD operation handler factory
    hook-executor.ts          # Lifecycle hook runner
  router/
    express-router.ts         # Express router generator
  middleware/
    error-handler.ts          # Error handling middleware
    auth.ts                   # Auth & permission middleware
  utils/
    errors.ts                 # Custom error classes
    logger.ts                 # Default logger
examples/
  basic-usage.ts              # Full working example
```
