import { Router, RequestHandler } from 'express'
import { Model } from 'mongoose'
import { CollectionConfig, DefaultConfig, Logger } from '../types'
import { SchemaAdapter } from '../types/schema'
import { createCRUDHandlers } from '../engine/crud-handlers'
import { createPermissionMiddleware } from '../middleware/auth'

interface RouterOptions {
  collectionName: string
  model: Model<any>
  adapter: SchemaAdapter
  config: CollectionConfig
  defaults?: DefaultConfig
  logger?: Logger
  authMiddleware?: RequestHandler
}

/**
 * Create an Express router for a single collection with all CRUD routes.
 */
export function createCollectionRouter(options: RouterOptions): Router {
  const { collectionName, model, adapter, config, defaults, logger, authMiddleware } = options

  const router = Router()
  const handlers = createCRUDHandlers({ collectionName, model, adapter, config, defaults, logger })

  const operations = ['list', 'get', 'create', 'update', 'patch', 'delete'] as const

  // Build middleware stacks for each operation
  const middlewareStacks: Record<string, RequestHandler[]> = {}
  for (const op of operations) {
    const stack: RequestHandler[] = []

    // Global auth middleware
    if (authMiddleware) {
      stack.push(authMiddleware)
    }

    // Per-collection middleware (all)
    if (config.middleware?.all) {
      stack.push(...config.middleware.all)
    }

    // Per-operation middleware
    const opMiddleware = config.middleware?.[op]
    if (opMiddleware) {
      stack.push(...opMiddleware)
    }

    // Permission middleware
    if (config.permissions) {
      stack.push(createPermissionMiddleware(collectionName, op, config.permissions) as RequestHandler)
    }

    middlewareStacks[op] = stack
  }

  // Register routes
  router.get('/', ...middlewareStacks.list, handlers.list as RequestHandler)
  router.get('/:id', ...middlewareStacks.get, handlers.get as RequestHandler)
  router.post('/', ...middlewareStacks.create, handlers.create as RequestHandler)
  router.put('/:id', ...middlewareStacks.update, handlers.update as RequestHandler)
  router.patch('/:id', ...middlewareStacks.patch, handlers.patch as RequestHandler)
  router.delete('/:id', ...middlewareStacks.delete, handlers.delete as RequestHandler)

  return router
}
