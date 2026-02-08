import { Model } from 'mongoose'
import { CollectionConfig, DefaultConfig, Logger } from '../types'
import { SchemaAdapter } from '../types/schema'

/**
 * Framework-agnostic request abstraction.
 * Every framework adapter maps its native request into this shape.
 */
export interface MonapiRequest {
  /** URL path parameters (e.g. { id: '123' }) */
  params: Record<string, string>

  /** Query string parameters */
  query: Record<string, any>

  /** Parsed request body */
  body: any

  /** Request headers (lowercased keys) */
  headers: Record<string, string | string[] | undefined>

  /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
  method: string

  /** URL path */
  path: string

  /** Authenticated user (set by auth middleware) */
  user?: any

  /** Original framework-specific request object */
  raw: any
}

/**
 * Framework-agnostic response abstraction.
 */
export interface MonapiResponse {
  /** Set HTTP status code */
  status(code: number): MonapiResponse

  /** Send JSON response */
  json(data: any): void

  /** Set a response header */
  setHeader(key: string, value: string): MonapiResponse

  /** Original framework-specific response object */
  raw: any
}

/**
 * A framework-agnostic handler function.
 * Takes MonapiRequest/MonapiResponse, returns void or throws.
 */
export type MonapiHandler = (req: MonapiRequest, res: MonapiResponse) => Promise<void> | void

/**
 * Result returned by core CRUD operations (framework-agnostic).
 */
export interface OperationResult {
  statusCode: number
  data: any
  meta?: {
    page: number
    limit: number
    total: number
    totalPages?: number
  }
}

/**
 * Context for a registered collection (used internally by adapters).
 */
export interface CollectionContext {
  name: string
  model: Model<any>
  adapter: SchemaAdapter
  config: CollectionConfig
  defaults?: DefaultConfig
  logger?: Logger
}

/**
 * Framework adapter interface.
 * Each supported framework implements this to integrate with monapi.
 */
export interface FrameworkAdapter {
  /** Adapter name (e.g. 'express', 'fastify', 'hono', 'nestjs') */
  readonly name: string

  /**
   * Build a framework-specific router/plugin from registered collections.
   * Returns the native router object for that framework.
   */
  createRouter(
    collections: Map<string, CollectionContext>,
    options?: { basePath?: string; authMiddleware?: any },
  ): any

  /**
   * Wrap a MonapiHandler into a framework-native handler.
   */
  wrapHandler(handler: MonapiHandler): any

  /**
   * Create a framework-native error handler.
   */
  createErrorHandler(logger?: Logger): any
}

/**
 * Type of built-in framework adapters.
 */
export type BuiltinFramework = 'express' | 'hono'
