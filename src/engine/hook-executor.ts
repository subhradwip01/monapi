import { LifecycleHooks, HookContext, CRUDOperation, MongoQuery, User } from '../types'
import { Logger } from '../types/config'

interface CreateHookContextParams {
  collection: string
  operation: CRUDOperation
  /** Raw framework request (Express Request, Hono Context, etc.) */
  req: any
  /** Raw framework response (Express Response, Hono Context, etc.) */
  res: any
  query?: MongoQuery
  data?: any
  id?: string
  result?: any
}

/**
 * Create a hook context object
 */
export function createHookContext(params: CreateHookContextParams): HookContext {
  const user = params.req?.user as User | undefined

  return {
    collection: params.collection,
    operation: params.operation,
    user,
    query: params.query,
    data: params.data,
    id: params.id,
    result: params.result,
    req: params.req,
    res: params.res,
    meta: {},
  }
}

/**
 * Execute a lifecycle hook if it exists.
 * Returns the (possibly modified) context.
 */
export async function executeHook(
  hooks: Partial<LifecycleHooks> | undefined,
  hookName: keyof LifecycleHooks,
  ctx: HookContext,
  logger?: Logger,
): Promise<HookContext> {
  if (!hooks) return ctx

  const hookFn = hooks[hookName]
  if (!hookFn) return ctx

  try {
    await hookFn(ctx)
  } catch (error: any) {
    if (logger) {
      logger.error(`Hook '${hookName}' failed for collection '${ctx.collection}': ${error.message}`)
    }
    throw error
  }

  return ctx
}
