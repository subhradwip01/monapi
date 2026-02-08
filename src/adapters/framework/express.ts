import { Router, Request, Response, NextFunction, RequestHandler } from 'express'
import { FrameworkAdapter, MonapiRequest, MonapiResponse, MonapiHandler, CollectionContext } from '../../core/types'
import { Logger } from '../../types'
import { MonapiError } from '../../utils/errors'
import { checkPermissions } from '../../core/permission-checker'
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  patchDocument,
  deleteDocument,
} from '../../core/crud-operations'

/**
 * Convert an Express Request to MonapiRequest.
 */
function toMonapiRequest(req: Request): MonapiRequest {
  return {
    params: req.params as Record<string, string>,
    query: req.query as Record<string, any>,
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
    method: req.method,
    path: req.path,
    user: (req as any).user,
    raw: req,
  }
}

/**
 * Create a MonapiResponse wrapping an Express Response.
 */
function toMonapiResponse(res: Response): MonapiResponse {
  const wrapper: MonapiResponse = {
    raw: res,
    status(code: number) {
      res.status(code)
      return wrapper
    },
    json(data: any) {
      res.json(data)
    },
    setHeader(key: string, value: string) {
      res.setHeader(key, value)
      return wrapper
    },
  }
  return wrapper
}

/**
 * Express framework adapter.
 */
export class ExpressAdapter implements FrameworkAdapter {
  readonly name = 'express'

  createRouter(
    collections: Map<string, CollectionContext>,
    options?: { basePath?: string; authMiddleware?: RequestHandler },
  ): Router {
    const mainRouter = Router()
    const basePath = options?.basePath ?? ''

    for (const [name, ctx] of collections) {
      const collectionRouter = this.buildCollectionRouter(ctx, options?.authMiddleware)
      const path = basePath ? `${basePath}/${name}` : `/${name}`
      mainRouter.use(path, collectionRouter)
    }

    return mainRouter
  }

  wrapHandler(handler: MonapiHandler): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(toMonapiRequest(req), toMonapiResponse(res))
      } catch (error) {
        next(error)
      }
    }
  }

  createErrorHandler(logger?: Logger): any {
    return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      if (err instanceof MonapiError) {
        if (logger) logger.warn(`${err.code}: ${err.message}`, { statusCode: err.statusCode })
        res.status(err.statusCode).json({
          error: { code: err.code, message: err.message, details: err.details },
        })
        return
      }

      if (logger) logger.error(`Unhandled error: ${err.message}`, { stack: err.stack })
      const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } })
    }
  }

  private buildCollectionRouter(ctx: CollectionContext, authMiddleware?: RequestHandler): Router {
    const router = Router()
    const { name, config } = ctx
    const ops = ['list', 'get', 'create', 'update', 'patch', 'delete'] as const

    const opHandlers = {
      list: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(listDocuments, mReq, mRes, ctx),
      get: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(getDocument, mReq, mRes, ctx),
      create: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(createDocument, mReq, mRes, ctx),
      update: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(updateDocument, mReq, mRes, ctx),
      patch: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(patchDocument, mReq, mRes, ctx),
      delete: (mReq: MonapiRequest, mRes: MonapiResponse) => this.handleOp(deleteDocument, mReq, mRes, ctx),
    }

    for (const op of ops) {
      const stack: RequestHandler[] = []

      if (authMiddleware) stack.push(authMiddleware)
      if (config.middleware?.all) stack.push(...config.middleware.all)
      if (config.middleware?.[op]) stack.push(...config.middleware[op]!)

      // Permission check
      if (config.permissions) {
        stack.push(async (req: Request, _res: Response, next: NextFunction) => {
          try {
            await checkPermissions(toMonapiRequest(req), name, op, config.permissions)
            next()
          } catch (error) {
            next(error)
          }
        })
      }

      // Use custom handler if provided, otherwise use default
      const handler = config.handlers?.[op]
        ? (config.handlers[op] as RequestHandler)
        : this.wrapHandler(opHandlers[op])

      switch (op) {
        case 'list':
          router.get('/', ...stack, handler)
          break
        case 'get':
          router.get('/:id', ...stack, handler)
          break
        case 'create':
          router.post('/', ...stack, handler)
          break
        case 'update':
          router.put('/:id', ...stack, handler)
          break
        case 'patch':
          router.patch('/:id', ...stack, handler)
          break
        case 'delete':
          router.delete('/:id', ...stack, handler)
          break
      }
    }

    return router
  }

  private async handleOp(
    operation: (req: MonapiRequest, res: MonapiResponse, opts: any) => Promise<any>,
    mReq: MonapiRequest,
    mRes: MonapiResponse,
    ctx: CollectionContext,
  ): Promise<void> {
    const result = await operation(mReq, mRes, {
      collectionName: ctx.name,
      model: ctx.model,
      adapter: ctx.adapter,
      config: ctx.config,
      defaults: ctx.defaults,
      logger: ctx.logger,
    })

    // If preventDefault was used in a hook, result.statusCode is 0
    if (result.statusCode === 0) return

    if (result.meta) {
      mRes.status(result.statusCode).json({ data: result.data, meta: result.meta })
    } else {
      mRes.status(result.statusCode).json({ data: result.data })
    }
  }
}
