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
