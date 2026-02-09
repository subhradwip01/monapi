import { CRUDOperation, User } from './hooks'

/**
 * Permission context for permission functions
 */
export interface PermissionContext {
  user: User
  collection: string
  operation: CRUDOperation
  data?: any
  id?: string
  /** Raw framework request object (Express Request, Hono Context, etc.) */
  req: any
}

/**
 * Permission function that returns boolean or Promise<boolean>
 */
export type PermissionFunction = (ctx: PermissionContext) => boolean | Promise<boolean>

/**
 * Permission definition - can be 'public' (no auth), array of roles, or custom function
 */
export type Permission = 'public' | string[] | PermissionFunction

/**
 * Permissions configuration for a collection
 */
export interface PermissionConfig {
  list?: Permission
  get?: Permission
  create?: Permission
  update?: Permission
  patch?: Permission
  delete?: Permission
}

/**
 * Field-level permissions
 */
export interface FieldPermission {
  read?: string[]
  write?: string[]
}

/**
 * Field-level permissions map
 */
export interface FieldPermissions {
  [fieldName: string]: FieldPermission
}

/**
 * Auth middleware function (framework-specific: Express middleware or Hono middleware)
 */
export type AuthMiddleware = ((...args: any[]) => any) | any

/**
 * Auth configuration
 */
export interface AuthConfig {
  /** Custom auth middleware to extract user from request */
  middleware?: AuthMiddleware

  /** JWT secret (if using built-in JWT auth) */
  jwtSecret?: string

  /** JWT options */
  jwtOptions?: {
    algorithm?: string
    expiresIn?: string
  }

  /** Session secret (if using session auth) */
  sessionSecret?: string
}
