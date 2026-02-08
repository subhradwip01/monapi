import { Request, Response } from 'express'
import { MongoQuery } from './query'

/**
 * CRUD operation types
 */
export type CRUDOperation = 'find' | 'create' | 'update' | 'patch' | 'delete'

/**
 * User context (populated by auth middleware)
 */
export interface User {
  id: string
  roles?: string[]
  [key: string]: any
}

/**
 * Hook context passed to all lifecycle hooks
 * This is mutable and can be modified by hooks
 */
export interface HookContext {
  /** Collection name */
  collection: string

  /** Operation being performed */
  operation: CRUDOperation

  /** Authenticated user (if auth enabled) */
  user?: User

  /** MongoDB query object (for find operations) */
  query?: MongoQuery

  /** Request data (for create/update operations) */
  data?: any

  /** Result from database operation (for after hooks) */
  result?: any

  /** Document ID (for get/update/delete operations) */
  id?: string

  /** Express request object */
  req: Request

  /** Express response object */
  res: Response

  /** Additional metadata */
  meta?: Record<string, any>

  /** Flag to prevent default operation */
  preventDefault?: boolean
}

/**
 * Hook function signature
 */
export type HookFunction = (ctx: HookContext) => Promise<void> | void

/**
 * All available lifecycle hooks
 */
export interface LifecycleHooks {
  beforeFind?: HookFunction
  afterFind?: HookFunction
  beforeCreate?: HookFunction
  afterCreate?: HookFunction
  beforeUpdate?: HookFunction
  afterUpdate?: HookFunction
  beforeDelete?: HookFunction
  afterDelete?: HookFunction
}

/**
 * Hook registry entry
 */
export interface HookEntry {
  collection: string
  operation: keyof LifecycleHooks
  handler: HookFunction
  priority?: number
}
