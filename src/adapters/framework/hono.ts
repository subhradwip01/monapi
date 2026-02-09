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
 * Convert a Hono context to MonapiRequest.
 * Hono uses `c.req` (HonoRequest) and `c.get('user')` for user context.
 */
function toMonapiRequest(c: any): MonapiRequest {
  return {
    params: c.req.param() || {},
    query: c.req.query() || {},
    body: null, // body is async in Hono - set separately
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    method: c.req.method,
    path: c.req.path,
    user: c.get('user'),
    raw: c,
  }
}

/**
 * Create a MonapiResponse wrapping a Hono context.
 */
function toMonapiResponse(c: any): MonapiResponse {
  let statusCode = 200
  let responseData: any = null

  const wrapper: MonapiResponse = {
    raw: c,
    status(code: number) {
      statusCode = code
      return wrapper
    },
    json(data: any) {
      responseData = data
    },
    setHeader(key: string, value: string) {
      c.header(key, value)
      return wrapper
    },
  }

  // Attach getter so adapter can read the buffered response
  ;(wrapper as any)._getResponse = () => ({ statusCode, data: responseData })

  return wrapper
}

/**
 * Hono framework adapter.
 * Works with Bun, Deno, Cloudflare Workers, and Node.js.
 *
 * Usage:
 *   const monapi = new Monapi({ connection, framework: 'hono' })
 *   monapi.resource('users', { schema: UserSchema })
 *   const app = new Hono()
 *   app.route('/api', monapi.router())
 */
export class HonoAdapter implements FrameworkAdapter {
  readonly name = 'hono'

  /**
   * Returns a Hono app instance with all collection routes registered.
   * Expects Hono to be available at runtime (peer dependency).
   */
  createRouter(
    collections: Map<string, CollectionContext>,
    options?: { basePath?: string; authMiddleware?: any },
  ): any {
    // Dynamically require Hono to avoid hard dependency
    let Hono: any
    try {
      Hono = require('hono').Hono
    } catch {
      throw new Error(
        'Hono is required for the Hono adapter. Install it: npm install hono',
      )
    }

    const app = new Hono()

    // Global error handler
    app.onError((err: Error, c: any) => {
      if (err instanceof MonapiError) {
        return c.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          err.statusCode,
        )
      }
      const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      return c.json({ error: { code: 'INTERNAL_ERROR', message } }, 500)
    })

    for (const [name, ctx] of collections) {
      this.registerCollectionRoutes(app, `/${name}`, ctx, options?.authMiddleware)
    }

    return app
  }

  wrapHandler(handler: MonapiHandler): any {
    return async (c: any) => {
      const mReq = toMonapiRequest(c)
      // Parse body for non-GET requests
      if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
        try {
          mReq.body = await c.req.json()
        } catch {
          mReq.body = {}
        }
      }

      const mRes = toMonapiResponse(c)
      await handler(mReq, mRes)

      const { statusCode, data } = (mRes as any)._getResponse()
      if (data !== null) {
        return c.json(data, statusCode)
      }
    }
  }

  createErrorHandler(logger?: Logger): any {
    return (err: Error, c: any) => {
      if (err instanceof MonapiError) {
        if (logger) logger.warn(`${err.code}: ${err.message}`)
        return c.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          err.statusCode,
        )
      }

      if (logger) logger.error(`Unhandled error: ${err.message}`)
      const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
      return c.json({ error: { code: 'INTERNAL_ERROR', message } }, 500)
    }
  }

  private registerCollectionRoutes(app: any, prefix: string, ctx: CollectionContext, authMiddleware?: any): void {
    const { name, config } = ctx

    const createHandler = (
      op: string,
      handler: (req: MonapiRequest, res: MonapiResponse, opts: any) => Promise<any>,
    ) => {
      return async (c: any) => {
        const isPublic = config.permissions?.[op as keyof typeof config.permissions] === 'public'

        // Run auth middleware for non-public operations
        if (authMiddleware && !isPublic) {
          await authMiddleware(c, async () => {})
        }

        const mReq = toMonapiRequest(c)

        // Parse body for write operations
        if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
          try {
            mReq.body = await c.req.json()
          } catch {
            mReq.body = {}
          }
        }

        // Check permissions (skip for public operations)
        if (config.permissions && !isPublic) {
          await checkPermissions(mReq, name, op, config.permissions)
        }

        const mRes = toMonapiResponse(c)
        const result = await handler(mReq, mRes, {
          collectionName: ctx.name,
          model: ctx.model,
          adapter: ctx.adapter,
          config: ctx.config,
          defaults: ctx.defaults,
          logger: ctx.logger,
        })

        if (result.statusCode === 0) return c.body(null, 204)

        if (result.meta) {
          return c.json({ data: result.data, meta: result.meta }, result.statusCode)
        }
        return c.json({ data: result.data }, result.statusCode)
      }
    }

    app.get(prefix, createHandler('list', listDocuments))
    app.get(`${prefix}/:id`, createHandler('get', getDocument))
    app.post(prefix, createHandler('create', createDocument))
    app.put(`${prefix}/:id`, createHandler('update', updateDocument))
    app.patch(`${prefix}/:id`, createHandler('patch', patchDocument))
    app.delete(`${prefix}/:id`, createHandler('delete', deleteDocument))
  }
}
