# Monapi - File Reference

---

## Root Config Files

| File | Purpose |
|------|---------|
| `package.json` | npm package manifest. Defines name (`monapi`), version, scripts, dependencies (mongoose), peer dependencies (express/hono, mongoose, @typegoose/typegoose), dev dependencies (TypeScript, Jest, ESLint, tsup). Exports CJS, ESM, and type declarations. |
| `tsconfig.json` | TypeScript configuration. Targets ES2020, strict mode enabled, outputs to `dist/`. Includes all `src/**/*`, excludes tests and node_modules. |
| `tsup.config.ts` | Build configuration using tsup. Bundles `src/index.ts` into CJS (`.js`) and ESM (`.mjs`) formats with TypeScript declarations (`.d.ts`). Tree-shakable, externals: mongoose + express + hono + @typegoose/typegoose. |
| `jest.config.js` | Test runner config. Uses `ts-jest` preset, looks for tests in `src/` and `tests/` directories, collects coverage from `src/**/*.ts`. |
| `.eslintrc.js` | ESLint config with TypeScript parser and Prettier integration. |
| `.prettierrc` | Code formatting rules (single quotes, no semicolons, trailing commas, 100 char width). |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `coverage/`, `.env`, OS files. |

---

## Source Code (`src/`)

### Entry Points

| File | Purpose |
|------|---------|
| `src/index.ts` | **Public API barrel.** Re-exports everything consumers need: `Monapi` class, core types (`MonapiRequest`, `MonapiResponse`, `FrameworkAdapter`), CRUD operations, permission checker, all TypeScript types/interfaces, schema adapters (`MongooseAdapter`, `TypegooseAdapter`), framework adapters (`ExpressAdapter`, `HonoAdapter`), error classes, and engine utilities (`parseFilters`, `buildQuery`). |
| `src/monapi.ts` | **Main orchestrator class.** The `Monapi` class is the primary user-facing API. Users call `resource(name, config)` to register MongoDB collections, then `router()` to get a framework-specific router with all CRUD routes auto-generated. Accepts `framework: 'express' | 'hono'` to select the adapter. Handles model resolution (auto-creates Mongoose models from schemas), adapter creation, auth middleware setup, and router mounting. |

### Core Abstractions (`src/core/`)

| File | Purpose |
|------|---------|
| `src/core/types.ts` | **Framework-agnostic type definitions.** Defines `MonapiRequest`, `MonapiResponse`, `MonapiHandler`, `OperationResult`, `CollectionContext`, and `FrameworkAdapter` interface. Also defines `BuiltinFramework = 'express' | 'hono'`. |
| `src/core/crud-operations.ts` | **Pure CRUD business logic.** Framework-agnostic functions: `listDocuments`, `getDocument`, `createDocument`, `updateDocument`, `patchDocument`, `deleteDocument`. All run lifecycle hooks, support `preventDefault`, and return `OperationResult`. |
| `src/core/permission-checker.ts` | **Framework-agnostic permission checking.** `checkPermissions()` evaluates permissions: `'public'` skips auth, `string[]` checks user roles, custom functions get full `PermissionContext`. |

### Type Definitions (`src/types/`)

| File | Purpose |
|------|---------|
| `src/types/config.ts` | **Core configuration types.** `MonapiConfig`, `CollectionConfig`, `DefaultConfig`, `Handler`, `CRUDHandlers`, `MiddlewareConfig`, `Logger`, response types. |
| `src/types/query.ts` | **Query & filter types.** `FilterOperator`, `FilterCondition`, `ParsedFilters`, `QueryOptions`, `MongoQuery`, `PaginationMeta`, `QueryConfig`, `FieldType` enum. |
| `src/types/schema.ts` | **Schema adapter interface.** `SchemaAdapter` interface, `ValidationResult`, `ValidationError`, `FieldMetadata`, `SchemaType` enum (Mongoose, Typegoose, Unknown). |
| `src/types/auth.ts` | **Auth & permission types.** `PermissionContext`, `PermissionFunction`, `Permission`, `PermissionConfig`, `FieldPermission`, `FieldPermissions`, `AuthMiddleware`, `AuthConfig`. |
| `src/types/hooks.ts` | **Lifecycle hook types.** `CRUDOperation`, `User`, `HookContext`, `HookFunction`, `LifecycleHooks`, `HookEntry`. |
| `src/types/index.ts` | **Barrel re-export.** Re-exports all types from auth, config, hooks, query, schema. |

### Schema Adapters (`src/adapters/schema/`)

| File | Purpose |
|------|---------|
| `src/adapters/schema/MongooseAdapter.ts` | **Mongoose schema adapter.** Implements `SchemaAdapter` for Mongoose Schema and Model objects. Extracts field names, maps Mongoose types to `FieldType` enum, reads field metadata, validates data using Mongoose's built-in validation. |
| `src/adapters/schema/TypegooseAdapter.ts` | **Typegoose schema adapter.** Implements `SchemaAdapter` for Typegoose decorator-based classes. Dynamically imports `@typegoose/typegoose` to call `getModelForClass()`, then delegates all operations to a `MongooseAdapter` instance (composition). Supports `existingConnection` option. |
| `src/adapters/schema/index.ts` | **Schema detection & factory.** `detectSchemaType()` auto-detects whether a schema is Mongoose, Typegoose, or Unknown. `createSchemaAdapter()` creates the right adapter. Re-exports both adapters. |

### Framework Adapters (`src/adapters/framework/`)

| File | Purpose |
|------|---------|
| `src/adapters/framework/express.ts` | **Express framework adapter.** Implements `FrameworkAdapter` for Express. Converts Express req/res to framework-agnostic types, builds per-collection routers with middleware stacks. |
| `src/adapters/framework/hono.ts` | **Hono framework adapter.** Implements `FrameworkAdapter` for Hono (Bun, Deno, Cloudflare Workers, Node). Dynamically requires Hono at runtime. |
| `src/adapters/framework/index.ts` | **Adapter factory.** `resolveFrameworkAdapter()` accepts `'express'`, `'hono'`, or a custom `FrameworkAdapter` object. |

### Engine (`src/engine/`)

| File | Purpose |
|------|---------|
| `src/engine/filter-parser.ts` | **Query parameter to MongoDB filter converter.** Supports simple equality, double-underscore operators, and advanced bracket syntax. Auto-coerces types, enforces security limits. |
| `src/engine/query-builder.ts` | **Full MongoDB query builder.** Builds complete `MongoQuery` objects with filter, sort, pagination, and field projection. |
| `src/engine/hook-executor.ts` | **Lifecycle hook runner.** `createHookContext()` and `executeHook()` for running sync/async lifecycle hooks. |

### Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `src/middleware/auth.ts` | **Legacy Express auth middleware.** `createPermissionMiddleware()` and `createAuthMiddleware()` for Express. Superseded by `src/core/permission-checker.ts`. |
| `src/middleware/error-handler.ts` | **Express error handling middleware.** `createErrorHandler()` returns Express error middleware with structured error JSON responses. |

### Utilities (`src/utils/`)

| File | Purpose |
|------|---------|
| `src/utils/errors.ts` | **Custom error classes.** `MonapiError`, `NotFoundError`, `ValidationError`, `ForbiddenError`, `UnauthorizedError`, `BadRequestError`. |
| `src/utils/logger.ts` | **Default logger.** Console-based logger with `[monapi]` prefix. |

---

## Tests (`tests/`)

| File | What it covers |
|------|----------------|
| `tests/unit/filter-parser.test.ts` | Simple equality, type coercion, all operators, bracket syntax, security (injection, whitelist, regex). |
| `tests/unit/query-builder.test.ts` | Filter passthrough, sort, pagination, projection, combined query, `buildPaginationMeta`. |
| `tests/unit/mongoose-adapter.test.ts` | Field listing, type detection, metadata, validation, schema/model getters, Model construction. |
| `tests/unit/typegoose-adapter.test.ts` | TypegooseAdapter creation, getModelForClass delegation, field extraction, type detection, metadata, validation, existingConnection option. |
| `tests/unit/schema-detection.test.ts` | Mongoose Schema detection, Typegoose detection via Reflect metadata, Unknown for plain objects/null/undefined/strings, adapter creation. |
| `tests/unit/hook-executor.test.ts` | Context creation, hook execution, no-op for missing hooks, context mutation, async hooks, error handling. |
| `tests/unit/auth-middleware.test.ts` | Permission checks, role-based auth, custom functions, createAuthMiddleware. |
| `tests/unit/error-handler.test.ts` | MonapiError handling, ValidationError, generic errors, production mode. |
| `tests/unit/errors.test.ts` | All error classes: properties, status codes, instanceof chain. |
| `tests/unit/core-permission-checker.test.ts` | Permission checking, public permissions, role-based, custom functions. |
| `tests/unit/framework-adapters.test.ts` | Adapter resolution, ExpressAdapter, HonoAdapter. |

---

## Examples (`examples/`)

| File | Purpose |
|------|---------|
| `examples/basic-usage.ts` | Full working example with Express: schemas, Monapi setup, resource registration, router mounting. |
| `examples/express-example.ts` | Express-specific usage example. |
| `examples/hono-example.ts` | Hono-specific usage example. |
| `examples/runnable-demo.ts` | Runnable demo script. |

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
    hook-executor.ts                # Lifecycle hook runner
  adapters/
    schema/
      MongooseAdapter.ts            # Mongoose schema/model adapter
      TypegooseAdapter.ts           # Typegoose class adapter (delegates to MongooseAdapter)
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
  middleware/
    auth.ts                         # Legacy Express auth middleware
    error-handler.ts                # Express error middleware
  utils/
    errors.ts                       # Custom error classes
    logger.ts                       # Default logger
tests/
  unit/
    filter-parser.test.ts
    query-builder.test.ts
    mongoose-adapter.test.ts
    typegoose-adapter.test.ts       # Typegoose adapter tests
    schema-detection.test.ts
    errors.test.ts
    error-handler.test.ts
    hook-executor.test.ts
    auth-middleware.test.ts
    core-permission-checker.test.ts
    framework-adapters.test.ts
examples/
  basic-usage.ts
  express-example.ts
  hono-example.ts
  runnable-demo.ts
```
