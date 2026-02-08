# Monapi - File Reference

> Total: 2,148 lines of source code + 1,120 lines of tests = 3,268 lines

---

## Root Config Files

| File | Purpose |
|------|---------|
| `package.json` | npm package manifest. Defines name (`monapi`), version, scripts, dependencies (mongoose), peer dependencies (express, mongoose), dev dependencies (TypeScript, Jest, ESLint, tsup). Exports CJS, ESM, and type declarations. |
| `tsconfig.json` | TypeScript configuration. Targets ES2020, strict mode enabled, outputs to `dist/`. Includes all `src/**/*`, excludes tests and node_modules. |
| `tsup.config.ts` | Build configuration using tsup. Bundles `src/index.ts` into CJS (`.js`) and ESM (`.mjs`) formats with TypeScript declarations (`.d.ts`). Tree-shakable, externals: mongoose + express. |
| `jest.config.js` | Test runner config. Uses `ts-jest` preset, looks for tests in `src/` and `tests/` directories, collects coverage from `src/**/*.ts`. |
| `.eslintrc.js` | ESLint config with TypeScript parser and Prettier integration. |
| `.prettierrc` | Code formatting rules (single quotes, no semicolons, trailing commas, 100 char width). |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `coverage/`, `.env`, OS files. |
| `crud.md` | Original project specification / requirements document. Describes all features monapi must support. |

---

## Source Code (`src/` - 2,148 lines)

### Entry Points

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 71 | **Public API barrel.** Re-exports everything consumers need: `Monapi` class, all TypeScript types/interfaces, schema adapters, error classes, and engine utilities (`parseFilters`, `buildQuery`). This is the single import point for the npm package. |
| `src/monapi.ts` | 123 | **Main orchestrator class.** The `Monapi` class is the primary user-facing API. Users call `resource(name, config)` to register MongoDB collections, then `router()` to get an Express router with all CRUD routes auto-generated. Handles model resolution (auto-creates Mongoose models from schemas), adapter creation, auth middleware setup, and router mounting. |

### Type Definitions (`src/types/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/config.ts` | 155 | **Core configuration types.** Defines `MonapiConfig` (top-level config with connection, basePath, auth, defaults), `CollectionConfig` (per-collection settings: schema, handlers, hooks, middleware, permissions, query config), `DefaultConfig` (pagination/security defaults), `Handler`, `CRUDHandlers`, `MiddlewareConfig`, `Logger`, `ListResponse`, `SingleResponse`, `ErrorResponse`. |
| `src/types/query.ts` | 88 | **Query & filter types.** Defines `FilterOperator` (eq, ne, gt, gte, lt, lte, in, nin, like, exists), `FilterCondition`, `ParsedFilters`, `QueryOptions`, `MongoQuery` (the final MongoDB query object with filter/sort/skip/limit/projection), `PaginationMeta`, `QueryConfig` (allowedFilters, allowedSorts, defaultSort, limits), `FieldType` enum (String, Number, Boolean, Date, ObjectId, Array, Object, Mixed). |
| `src/types/schema.ts` | 93 | **Schema adapter interface.** Defines the `SchemaAdapter` interface that all schema types must implement: `getFields()`, `getFieldType()`, `getFieldMetadata()`, `getAllFieldsMetadata()`, `validate()`, optional `getMongooseModel()` and `getMongooseSchema()`. Also defines `ValidationResult`, `ValidationError`, `FieldMetadata`, `SchemaType` enum (Mongoose, Typegoose, Zod, Joi, Yup), `SchemaOptions`. |
| `src/types/auth.ts` | 76 | **Auth & permission types.** Defines `PermissionContext` (user, collection, operation, data, request), `PermissionFunction`, `Permission` (string[] for roles or custom function), `PermissionConfig` (per-operation permissions), `FieldPermission`, `FieldPermissions`, `AuthMiddleware`, `AuthConfig` (custom middleware, JWT settings). |
| `src/types/hooks.ts` | 84 | **Lifecycle hook types.** Defines `CRUDOperation` ('find', 'create', 'update', 'patch', 'delete'), `User` (id + roles), `HookContext` (mutable context passed to hooks with collection, operation, user, query, data, result, req, res, meta, preventDefault), `HookFunction`, `LifecycleHooks` (beforeFind, afterFind, beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete), `HookEntry`. |
| `src/types/index.ts` | 6 | **Barrel re-export.** Re-exports all types from auth, config, hooks, query, schema. |

### Schema Adapters (`src/adapters/schema/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/adapters/schema/MongooseAdapter.ts` | 212 | **Mongoose schema adapter.** Implements `SchemaAdapter` for Mongoose Schema and Model objects. Extracts field names (excluding `_id`, `__v`), maps Mongoose types to `FieldType` enum, reads field metadata (required, default, enum), validates data using Mongoose's built-in validation (or basic object check if no model). Accepts either a Schema or Model in the constructor. |
| `src/adapters/schema/index.ts` | 82 | **Schema detection & factory.** `detectSchemaType()` auto-detects whether a schema is Mongoose, Typegoose, Zod, Joi, or Yup by checking for type-specific markers (instanceof Schema, `_def`+`parse` for Zod, `isJoi`, `__isYupSchema__`, Reflect metadata for Typegoose). `createSchemaAdapter()` creates the right adapter (currently only Mongoose implemented). `isSupportedSchema()` checks if a schema type is recognized. |

### Engine (`src/engine/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/engine/filter-parser.ts` | 256 | **Query parameter to MongoDB filter converter.** The core filtering engine. Supports 3 modes: (1) Simple equality `?age=25`, (2) Double-underscore operators `?age__gt=18&age__lt=29`, (3) Advanced bracket syntax `?filter[age][gt]=18`. Maps operators to MongoDB: eq→$eq, gt→$gt, in→$in, like→$regex, etc. Auto-coerces types (strings to numbers, booleans, dates). Security: field whitelist validation, operator whitelist, regex length limits, max filter count, blocks `$` prefixed fields. |
| `src/engine/query-builder.ts` | 192 | **Full MongoDB query builder.** Takes Express query params and builds a complete `MongoQuery` object. Calls `parseFilters()` for the filter, then parses: sort (`?sort=age,-createdAt` → `{age: 1, createdAt: -1}`), pagination (`?page=2&limit=20` → skip/limit with max enforcement), field projection (`?fields=name,email` → `{name: 1, email: 1}`). Also exports `buildPaginationMeta()` for response metadata and `extractPagination()` helper. |
| `src/engine/crud-handlers.ts` | 355 | **CRUD handler factory.** The heart of the API. `createCRUDHandlers()` generates 6 Express handlers for a collection: **list** (find with filters/sort/pagination/projection, parallel count query for meta), **get** (findById with projection), **create** (validate → save → 201), **update** (validate → findByIdAndUpdate with overwrite), **patch** (findByIdAndUpdate with $set, blocks `$` operators in body), **delete** (findByIdAndDelete). Every handler runs before/after hooks, supports `preventDefault`, and returns standardized `{ data, meta }` responses. |
| `src/engine/hook-executor.ts` | 61 | **Lifecycle hook runner.** `createHookContext()` builds a `HookContext` from request params (collection, operation, user from `req.user`, data, id, query). `executeHook()` runs a specific hook function if it exists, logs errors, and returns the (possibly mutated) context. Supports both sync and async hooks. |

### Router (`src/router/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/router/express-router.ts` | 67 | **Express router generator.** `createCollectionRouter()` creates an Express Router for one collection. Builds per-operation middleware stacks in order: global auth middleware → collection-wide middleware → per-operation middleware → permission check. Registers 6 routes: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`. |

### Middleware (`src/middleware/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/middleware/auth.ts` | 106 | **Auth & permission middleware.** `createPermissionMiddleware()` returns Express middleware that checks permissions for a specific operation: if permission is a string array, checks if user has any matching role; if permission is a function, calls it with full context. Returns 401 if no user, 403 if denied. `createAuthMiddleware()` returns the user-provided auth middleware or a no-op passthrough. |
| `src/middleware/error-handler.ts` | 42 | **Error handling middleware.** `createErrorHandler()` returns Express error middleware. For `MonapiError` subclasses, responds with the correct status code + structured error JSON. For unknown errors, responds 500 with message hidden in production (no stack trace leaks). Logs all errors if a logger is provided. |

### Utilities (`src/utils/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/errors.ts` | 58 | **Custom error classes.** Base `MonapiError` extends Error with `statusCode`, `code`, `details`. Subclasses: `NotFoundError` (404), `ValidationError` (400), `ForbiddenError` (403), `UnauthorizedError` (401), `BadRequestError` (400). All use `Object.setPrototypeOf` for correct instanceof checks. |
| `src/utils/logger.ts` | 21 | **Default logger.** Simple console-based logger implementing the `Logger` interface. Prefixes all messages with `[monapi]`. Debug messages suppressed in production (`NODE_ENV=production`). |

---

## Tests (`tests/` - 1,120 lines, 133 tests)

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

---

## Examples (`examples/`)

| File | Purpose |
|------|---------|
| `examples/basic-usage.ts` | Full working example showing how to use monapi: connects to MongoDB, defines User and Post schemas, creates Monapi instance with defaults, registers resources with query config/hooks/permissions, mounts router on Express, logs all available endpoints and query examples. |

---

## Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `docs/progress.md` | Build progress tracker. Tracks all 6 phases with checkboxes, architecture diagram, file list. Updated after each session. |
| `docs/files.md` | This file. Explains every file in the project. |
