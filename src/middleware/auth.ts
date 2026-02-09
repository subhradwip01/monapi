import { PermissionConfig, Permission, PermissionContext, AuthConfig, User, CRUDOperation } from '../types'
import { ForbiddenError, UnauthorizedError } from '../utils/errors'

/**
 * Map route operations to CRUD operations for permission checking
 */
const ROUTE_TO_CRUD: Record<string, CRUDOperation> = {
  list: 'find',
  get: 'find',
  create: 'create',
  update: 'update',
  patch: 'patch',
  delete: 'delete',
}

/**
 * Create middleware that checks permissions for a specific operation
 */
export function createPermissionMiddleware(
  collection: string,
  routeOp: string,
  permissions?: PermissionConfig,
) {
  return async (req: any, _res: any, next: any): Promise<void> => {
    try {
      // If no permissions configured, allow all
      if (!permissions) {
        next()
        return
      }

      const permission = permissions[routeOp as keyof PermissionConfig]

      // If no permission for this operation, allow
      if (!permission) {
        next()
        return
      }

      const user = req.user as User | undefined

      // Permission is set but no user - require auth
      if (!user) {
        throw new UnauthorizedError()
      }

      const crudOp = ROUTE_TO_CRUD[routeOp] || (routeOp as CRUDOperation)
      const allowed = await checkPermission(permission, {
        user,
        collection,
        operation: crudOp,
        data: req.body,
        id: req.params.id,
        req,
      })

      if (!allowed) {
        throw new ForbiddenError()
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Check a permission - either role-based (string array) or custom function
 */
async function checkPermission(
  permission: Permission,
  ctx: PermissionContext,
): Promise<boolean> {
  // Role-based: check if user has any of the required roles
  if (Array.isArray(permission)) {
    if (!ctx.user.roles || ctx.user.roles.length === 0) {
      return false
    }
    return permission.some((role) => ctx.user.roles?.includes(role))
  }

  // Custom permission function
  if (typeof permission === 'function') {
    return permission(ctx)
  }

  return false
}

/**
 * Create auth middleware that extracts user from request.
 * If authConfig has a custom middleware, use it.
 * Otherwise, this is a no-op (user must set req.user themselves).
 */
export function createAuthMiddleware(authConfig?: AuthConfig) {
  if (authConfig?.middleware) {
    return authConfig.middleware
  }

  // Default: no-op, expect user to be set by upstream middleware
  return (_req: any, _res: any, next: any): void => {
    next()
  }
}
