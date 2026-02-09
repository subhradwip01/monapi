import { Model } from 'mongoose'
import { MonapiConfig, CollectionConfig, Logger } from './types'
import { SchemaAdapter } from './types/schema'
import { createSchemaAdapter } from './adapters/schema'
import { resolveFrameworkAdapter } from './adapters/framework'
import { FrameworkAdapter, CollectionContext, BuiltinFramework } from './core/types'
import { defaultLogger } from './utils/logger'

/**
 * Main Monapi class - orchestrates everything.
 * Framework-agnostic: works with Express and Hono.
 *
 * Usage:
 *   // Express (default)
 *   const monapi = new Monapi({ connection: mongoose.connection })
 *   monapi.resource('users', { schema: UserSchema })
 *   app.use('/api', monapi.router())
 *
 *   // Hono
 *   const monapi = new Monapi({ connection, framework: 'hono' })
 *   monapi.resource('users', { schema: UserSchema })
 *   app.route('/api', monapi.router())
 */
export class Monapi {
  private config: MonapiConfig
  private logger: Logger
  private collections: Map<string, CollectionContext> = new Map()
  private frameworkAdapter: FrameworkAdapter

  constructor(config: MonapiConfig) {
    this.config = config
    this.logger = config.logger ?? defaultLogger
    this.frameworkAdapter = resolveFrameworkAdapter(
      config.framework as BuiltinFramework | FrameworkAdapter | undefined,
    )

    this.logger.debug(`Using framework adapter: ${this.frameworkAdapter.name}`)
  }

  /**
   * Register a collection resource.
   * This will auto-generate all CRUD endpoints for the collection.
   */
  resource(name: string, collectionConfig: CollectionConfig): this {
    const adapter = collectionConfig.adapter ?? createSchemaAdapter(collectionConfig.schema)
    const model = this.resolveModel(name, collectionConfig, adapter)

    this.collections.set(name, {
      name,
      model,
      adapter,
      config: collectionConfig,
      defaults: this.config.defaults,
      logger: this.logger,
    })

    this.logger.debug(`Registered resource: ${name}`, {
      fields: adapter.getFields(),
    })

    return this
  }

  /**
   * Generate the framework-specific router with all registered collection routes.
   *
   * - Express: returns an Express Router
   * - Hono: returns a Hono app instance
   */
  router(): any {
    const result = this.frameworkAdapter.createRouter(this.collections, {
      basePath: this.config.basePath,
      authMiddleware: this.config.auth?.middleware,
    })

    // For Express, attach error handler to the router
    if (this.frameworkAdapter.name === 'express') {
      result.use(this.frameworkAdapter.createErrorHandler(this.logger))
    }

    for (const [name] of this.collections) {
      const basePath = this.config.basePath ?? ''
      const path = basePath ? `${basePath}/${name}` : `/${name}`
      this.logger.info(`Mounted routes: ${path} [${this.frameworkAdapter.name}]`)
    }

    return result
  }

  /**
   * Get the framework adapter instance.
   */
  getFrameworkAdapter(): FrameworkAdapter {
    return this.frameworkAdapter
  }

  /**
   * Get a registered collection's model.
   */
  getModel(name: string): Model<any> | undefined {
    return this.collections.get(name)?.model
  }

  /**
   * Get a registered collection's adapter.
   */
  getAdapter(name: string): SchemaAdapter | undefined {
    return this.collections.get(name)?.adapter
  }

  /**
   * Resolve or create a Mongoose model from the collection config.
   */
  private resolveModel(name: string, config: CollectionConfig, adapter: SchemaAdapter): Model<any> {
    if (config.model) {
      return config.model
    }

    const adapterModel = adapter.getMongooseModel?.()
    if (adapterModel) {
      return adapterModel
    }

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
