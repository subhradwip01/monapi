import { PermissionConfig, Permission, PermissionContext, User, CRUDOperation } from '../types'
import { ForbiddenError, UnauthorizedError } from '../utils/errors'
import { MonapiRequest } from './types'

/**
 * Map route operation names to CRUD operations.
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
 * Check permissions for a request. Throws UnauthorizedError or ForbiddenError.
 * Does nothing if no permissions are configured for this operation.
 */
export async function checkPermissions(
  req: MonapiRequest,
  collection: string,
  routeOp: string,
  permissions?: PermissionConfig,
): Promise<void> {
  if (!permissions) return

  const permission = permissions[routeOp as keyof PermissionConfig]
  if (!permission) return

  const user = req.user as User | undefined
  if (!user) throw new UnauthorizedError()

  const crudOp = ROUTE_TO_CRUD[routeOp] || (routeOp as CRUDOperation)
  const allowed = await evaluatePermission(permission, {
    user,
    collection,
    operation: crudOp,
    data: req.body,
    id: req.params.id,
    req: req.raw,
  })

  if (!allowed) throw new ForbiddenError()
}

/**
 * Evaluate a permission definition - role array or custom function.
 */
async function evaluatePermission(
  permission: Permission,
  ctx: PermissionContext,
): Promise<boolean> {
  if (Array.isArray(permission)) {
    if (!ctx.user.roles || ctx.user.roles.length === 0) return false
    return permission.some((role) => ctx.user.roles?.includes(role))
  }

  if (typeof permission === 'function') {
    return permission(ctx)
  }

  return false
}
