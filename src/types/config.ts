import { Connection, Model, Schema } from 'mongoose'
import { Request, Response, NextFunction, RequestHandler } from 'express'
import { LifecycleHooks } from './hooks'
import { PermissionConfig, FieldPermissions, AuthConfig } from './auth'
import { QueryConfig } from './query'
import { SchemaAdapter } from './schema'

/**
 * Handler function for CRUD operations
 */
export type Handler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

/**
 * Custom handlers for CRUD operations
 */
export interface CRUDHandlers {
  list: Handler
  get: Handler
  create: Handler
  update: Handler
  patch: Handler
  delete: Handler
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  all?: RequestHandler[]
  list?: RequestHandler[]
  get?: RequestHandler[]
  create?: RequestHandler[]
  update?: RequestHandler[]
  patch?: RequestHandler[]
  delete?: RequestHandler[]
}

/**
 * Collection configuration
 */
export interface CollectionConfig {
  /** Mongoose schema, Typegoose class, or validator schema (Zod/Joi/Yup) */
  schema: Schema | Model<any> | any

  /** Optional additional validator schema (for mixed usage) */
  validator?: any

  /** Optional Mongoose model (if using schema directly) */
  model?: Model<any>

  /** Custom handlers (override defaults) */
  handlers?: Partial<CRUDHandlers>

  /** Lifecycle hooks */
  hooks?: Partial<LifecycleHooks>

  /** Custom middleware */
  middleware?: MiddlewareConfig

  /** Permissions configuration */
  permissions?: PermissionConfig

  /** Field-level permissions */
  fields?: FieldPermissions

  /** Query configuration */
  query?: QueryConfig

  /** Schema adapter (auto-detected if not provided) */
  adapter?: SchemaAdapter
}

/**
 * Default configuration
 */
export interface DefaultConfig {
  /** Default pagination settings */
  pagination?: {
    limit?: number
    maxLimit?: number
  }

  /** Security settings */
  security?: {
    maxRegexLength?: number
    maxRegexComplexity?: number
    maxQueryCost?: number
  }

  /** Default query settings */
  query?: QueryConfig
}

/**
 * Main Monapi configuration
 */
export interface MonapiConfig {
  /** MongoDB connection */
  connection: Connection

  /** Base path for all routes (e.g., '/api') */
  basePath?: string

  /** Framework adapter ('express' or 'fastify') */
  framework?: 'express' | 'fastify'

  /** Default configuration */
  defaults?: DefaultConfig

  /** Auth configuration */
  auth?: AuthConfig

  /** Custom logger */
  logger?: Logger
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
}

/**
 * Response format for list operations
 */
export interface ListResponse<T = any> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

/**
 * Response format for single document operations
 */
export interface SingleResponse<T = any> {
  data: T
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
}
