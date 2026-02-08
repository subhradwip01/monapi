// Main class
export { Monapi } from './monapi'

// Core abstractions (framework-agnostic)
export type {
  MonapiRequest,
  MonapiResponse,
  MonapiHandler,
  OperationResult,
  CollectionContext,
  FrameworkAdapter,
  BuiltinFramework,
} from './core/types'

export {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  patchDocument,
  deleteDocument,
} from './core/crud-operations'

export { checkPermissions } from './core/permission-checker'

// Types
export type {
  MonapiConfig,
  CollectionConfig,
  DefaultConfig,
  Logger,
  Handler,
  CRUDHandlers,
  MiddlewareConfig,
  ListResponse,
  SingleResponse,
  ErrorResponse,
} from './types/config'

export type {
  FilterOperator,
  FilterCondition,
  ParsedFilters,
  QueryOptions,
  MongoQuery,
  PaginationMeta,
  QueryConfig,
} from './types/query'

export { FieldType } from './types/query'

export type {
  SchemaAdapter,
  ValidationResult,
  ValidationError as SchemaValidationError,
  FieldMetadata,
  SchemaOptions,
} from './types/schema'

export { SchemaType } from './types/schema'

export type {
  PermissionConfig,
  Permission,
  PermissionFunction,
  PermissionContext,
  FieldPermission,
  FieldPermissions,
  AuthConfig,
  AuthMiddleware,
} from './types/auth'

export type {
  CRUDOperation,
  User,
  HookContext,
  HookFunction,
  LifecycleHooks,
  HookEntry,
} from './types/hooks'

// Schema adapters
export { MongooseAdapter, createSchemaAdapter, detectSchemaType } from './adapters/schema'

// Framework adapters
export {
  ExpressAdapter,
  HonoAdapter,
  resolveFrameworkAdapter,
} from './adapters/framework'

// Utilities
export {
  MonapiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  BadRequestError,
} from './utils/errors'

// Engine (for advanced users)
export { parseFilters } from './engine/filter-parser'
export { buildQuery, buildPaginationMeta } from './engine/query-builder'

// Middleware (Express-specific, kept for backward compat)
export { createErrorHandler } from './middleware/error-handler'
