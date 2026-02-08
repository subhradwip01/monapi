import { Router, RequestHandler } from 'express'
import { Model } from 'mongoose'
import { MonapiConfig, CollectionConfig, Logger } from './types'
import { SchemaAdapter } from './types/schema'
import { createSchemaAdapter } from './adapters/schema'
import { createCollectionRouter } from './router/express-router'
import { createErrorHandler } from './middleware/error-handler'
import { createAuthMiddleware } from './middleware/auth'
import { defaultLogger } from './utils/logger'

/**
 * Main Monapi class - orchestrates everything.
 *
 * Usage:
 *   const monapi = new Monapi({ connection: mongoose.connection })
 *   monapi.resource('users', { schema: UserSchema })
 *   monapi.resource('posts', { schema: PostModel })
 *   app.use('/api', monapi.router())
 */
export class Monapi {
  private config: MonapiConfig
  private logger: Logger
  private collections: Map<string, { config: CollectionConfig; model: Model<any>; adapter: SchemaAdapter }> = new Map()
  private authMiddleware?: RequestHandler

  constructor(config: MonapiConfig) {
    this.config = config
    this.logger = config.logger ?? defaultLogger

    if (config.auth) {
      this.authMiddleware = createAuthMiddleware(config.auth)
    }
  }

  /**
   * Register a collection resource.
   * This will auto-generate all CRUD endpoints for the collection.
   */
  resource(name: string, collectionConfig: CollectionConfig): this {
    const adapter = collectionConfig.adapter ?? createSchemaAdapter(collectionConfig.schema)
    const model = this.resolveModel(name, collectionConfig, adapter)

    this.collections.set(name, { config: collectionConfig, model, adapter })

    this.logger.debug(`Registered resource: ${name}`, {
      fields: adapter.getFields(),
    })

    return this
  }

  /**
   * Generate the Express router with all registered collection routes.
   */
  router(): Router {
    const mainRouter = Router()
    const basePath = this.config.basePath ?? ''

    for (const [name, { config, model, adapter }] of this.collections) {
      const collectionRouter = createCollectionRouter({
        collectionName: name,
        model,
        adapter,
        config,
        defaults: this.config.defaults,
        logger: this.logger,
        authMiddleware: this.authMiddleware,
      })

      const path = basePath ? `${basePath}/${name}` : `/${name}`
      mainRouter.use(path, collectionRouter)

      this.logger.info(`Mounted routes: ${path}`)
    }

    // Attach error handler
    mainRouter.use(createErrorHandler(this.logger))

    return mainRouter
  }

  /**
   * Get a registered collection's model
   */
  getModel(name: string): Model<any> | undefined {
    return this.collections.get(name)?.model
  }

  /**
   * Get a registered collection's adapter
   */
  getAdapter(name: string): SchemaAdapter | undefined {
    return this.collections.get(name)?.adapter
  }

  /**
   * Resolve or create a Mongoose model from the collection config.
   */
  private resolveModel(name: string, config: CollectionConfig, adapter: SchemaAdapter): Model<any> {
    // If model is explicitly provided
    if (config.model) {
      return config.model
    }

    // If the adapter has a Mongoose model (e.g., Model was passed as schema)
    const adapterModel = adapter.getMongooseModel?.()
    if (adapterModel) {
      return adapterModel
    }

    // If a raw Mongoose Schema was provided, create a model
    const mongooseSchema = adapter.getMongooseSchema?.()
    if (mongooseSchema) {
      const modelName = name.charAt(0).toUpperCase() + name.slice(1)
      return this.config.connection.model(modelName, mongooseSchema)
    }

    throw new Error(
      `Cannot resolve Mongoose model for collection '${name}'. ` +
        'Provide a Mongoose Model, a Mongoose Schema, or set the model option.',
    )
  }
}
