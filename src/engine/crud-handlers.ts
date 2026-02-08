import { Request, Response, NextFunction } from 'express'
import { Model } from 'mongoose'
import { CollectionConfig, Handler, Logger, ListResponse, SingleResponse, DefaultConfig } from '../types'
import { SchemaAdapter } from '../types/schema'
import { buildQuery, buildPaginationMeta, extractPagination } from './query-builder'
import { createHookContext, executeHook } from './hook-executor'
import { NotFoundError, ValidationError } from '../utils/errors'

interface CRUDHandlerOptions {
  collectionName: string
  model: Model<any>
  adapter: SchemaAdapter
  config: CollectionConfig
  defaults?: DefaultConfig
  logger?: Logger
}

/**
 * Create all CRUD handlers for a collection
 */
export function createCRUDHandlers(options: CRUDHandlerOptions) {
  const { collectionName, model, adapter, config, defaults, logger } = options

  return {
    list: config.handlers?.list ?? createListHandler(collectionName, model, adapter, config, defaults, logger),
    get: config.handlers?.get ?? createGetHandler(collectionName, model, adapter, config, logger),
    create: config.handlers?.create ?? createCreateHandler(collectionName, model, adapter, config, logger),
    update: config.handlers?.update ?? createUpdateHandler(collectionName, model, adapter, config, logger),
    patch: config.handlers?.patch ?? createPatchHandler(collectionName, model, adapter, config, logger),
    delete: config.handlers?.delete ?? createDeleteHandler(collectionName, model, config, logger),
  }
}

/**
 * GET /:collection - List documents with filtering, sorting, pagination
 */
function createListHandler(
  collectionName: string,
  model: Model<any>,
  adapter: SchemaAdapter,
  config: CollectionConfig,
  defaults?: DefaultConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mongoQuery = buildQuery(req.query as Record<string, any>, {
        adapter,
        queryConfig: config.query ?? defaults?.query,
        defaultLimit: defaults?.pagination?.limit,
        maxLimit: defaults?.pagination?.maxLimit,
        maxRegexLength: defaults?.security?.maxRegexLength,
      })

      // Execute beforeFind hook
      const ctx = createHookContext({
        collection: collectionName,
        operation: 'find',
        req,
        res,
        query: mongoQuery,
      })
      await executeHook(config.hooks, 'beforeFind', ctx, logger)

      if (ctx.preventDefault) {
        return
      }

      // Use potentially modified query from hooks
      const query = ctx.query ?? mongoQuery

      const [docs, total] = await Promise.all([
        model
          .find(query.filter)
          .sort(query.sort)
          .skip(query.skip ?? 0)
          .limit(query.limit ?? 10)
          .select(query.projection ?? {})
          .lean()
          .exec(),
        model.countDocuments(query.filter).exec(),
      ])

      const { page, limit } = extractPagination(req.query as Record<string, any>, defaults?.pagination?.limit, defaults?.pagination?.maxLimit)

      // Execute afterFind hook
      ctx.result = docs
      await executeHook(config.hooks, 'afterFind', ctx, logger)

      const response: ListResponse = {
        data: ctx.result ?? docs,
        meta: buildPaginationMeta(total, page, limit),
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * GET /:collection/:id - Get a single document
 */
function createGetHandler(
  collectionName: string,
  model: Model<any>,
  _adapter: SchemaAdapter,
  config: CollectionConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params

      // Parse field projection
      const fieldsParam = (req.query as Record<string, any>).fields
      let projection: Record<string, 1> | undefined
      if (fieldsParam) {
        const fields = typeof fieldsParam === 'string' ? fieldsParam.split(',') : fieldsParam
        projection = {}
        for (const f of fields) {
          const trimmed = (f as string).trim()
          if (trimmed && !trimmed.startsWith('$')) {
            projection[trimmed] = 1
          }
        }
      }

      const ctx = createHookContext({
        collection: collectionName,
        operation: 'find',
        req,
        res,
        id,
      })
      await executeHook(config.hooks, 'beforeFind', ctx, logger)

      if (ctx.preventDefault) return

      let query = model.findById(id)
      if (projection) query = query.select(projection)

      const doc = await query.lean().exec()

      if (!doc) {
        throw new NotFoundError(collectionName, id)
      }

      ctx.result = doc
      await executeHook(config.hooks, 'afterFind', ctx, logger)

      const response: SingleResponse = { data: ctx.result ?? doc }
      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * POST /:collection - Create a document
 */
function createCreateHandler(
  collectionName: string,
  model: Model<any>,
  adapter: SchemaAdapter,
  config: CollectionConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body

      // Validate using adapter
      const validation = await adapter.validate(data)
      if (!validation.valid) {
        throw new ValidationError('Validation failed', validation.errors)
      }

      const ctx = createHookContext({
        collection: collectionName,
        operation: 'create',
        req,
        res,
        data: validation.data ?? data,
      })
      await executeHook(config.hooks, 'beforeCreate', ctx, logger)

      if (ctx.preventDefault) return

      const doc = await model.create(ctx.data ?? data)
      const result = doc.toObject()

      ctx.result = result
      await executeHook(config.hooks, 'afterCreate', ctx, logger)

      const response: SingleResponse = { data: ctx.result ?? result }
      res.status(201).json(response)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * PUT /:collection/:id - Full replace update
 */
function createUpdateHandler(
  collectionName: string,
  model: Model<any>,
  adapter: SchemaAdapter,
  config: CollectionConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      const data = req.body

      const validation = await adapter.validate(data)
      if (!validation.valid) {
        throw new ValidationError('Validation failed', validation.errors)
      }

      const ctx = createHookContext({
        collection: collectionName,
        operation: 'update',
        req,
        res,
        id,
        data: validation.data ?? data,
      })
      await executeHook(config.hooks, 'beforeUpdate', ctx, logger)

      if (ctx.preventDefault) return

      const doc = await model
        .findByIdAndUpdate(id, ctx.data ?? data, { new: true, runValidators: true, overwrite: true })
        .lean()
        .exec()

      if (!doc) {
        throw new NotFoundError(collectionName, id)
      }

      ctx.result = doc
      await executeHook(config.hooks, 'afterUpdate', ctx, logger)

      const response: SingleResponse = { data: ctx.result ?? doc }
      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * PATCH /:collection/:id - Partial update
 */
function createPatchHandler(
  collectionName: string,
  model: Model<any>,
  _adapter: SchemaAdapter,
  config: CollectionConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      const data = req.body

      // For patch, we don't do full validation - just check types
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new ValidationError('Request body must be an object')
      }

      // Block MongoDB operators in patch body
      for (const key of Object.keys(data)) {
        if (key.startsWith('$')) {
          throw new ValidationError(`Invalid field name: ${key}`)
        }
      }

      const ctx = createHookContext({
        collection: collectionName,
        operation: 'patch',
        req,
        res,
        id,
        data,
      })
      await executeHook(config.hooks, 'beforeUpdate', ctx, logger)

      if (ctx.preventDefault) return

      const doc = await model
        .findByIdAndUpdate(id, { $set: ctx.data ?? data }, { new: true, runValidators: true })
        .lean()
        .exec()

      if (!doc) {
        throw new NotFoundError(collectionName, id)
      }

      ctx.result = doc
      await executeHook(config.hooks, 'afterUpdate', ctx, logger)

      const response: SingleResponse = { data: ctx.result ?? doc }
      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}

/**
 * DELETE /:collection/:id - Delete a document
 */
function createDeleteHandler(
  collectionName: string,
  model: Model<any>,
  config: CollectionConfig,
  logger?: Logger,
): Handler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params

      const ctx = createHookContext({
        collection: collectionName,
        operation: 'delete',
        req,
        res,
        id,
      })
      await executeHook(config.hooks, 'beforeDelete', ctx, logger)

      if (ctx.preventDefault) return

      const doc = await model.findByIdAndDelete(id).lean().exec()

      if (!doc) {
        throw new NotFoundError(collectionName, id)
      }

      ctx.result = doc
      await executeHook(config.hooks, 'afterDelete', ctx, logger)

      res.json({ data: ctx.result ?? doc })
    } catch (error) {
      next(error)
    }
  }
}
