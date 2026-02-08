import { Model } from 'mongoose'
import { CollectionConfig, DefaultConfig, Logger, LifecycleHooks, HookContext, CRUDOperation, MongoQuery } from '../types'
import { SchemaAdapter } from '../types/schema'
import { buildQuery, buildPaginationMeta, extractPagination } from '../engine/query-builder'
import { NotFoundError, ValidationError } from '../utils/errors'
import { MonapiRequest, MonapiResponse, OperationResult } from './types'

interface OperationOptions {
  collectionName: string
  model: Model<any>
  adapter: SchemaAdapter
  config: CollectionConfig
  defaults?: DefaultConfig
  logger?: Logger
}

/**
 * Create a framework-agnostic hook context from MonapiRequest/MonapiResponse.
 */
function createCtx(
  collection: string,
  operation: CRUDOperation,
  req: MonapiRequest,
  res: MonapiResponse,
  extra: { query?: MongoQuery; data?: any; id?: string; result?: any } = {},
): HookContext {
  return {
    collection,
    operation,
    user: req.user,
    query: extra.query,
    data: extra.data,
    id: extra.id,
    result: extra.result,
    req: req.raw,
    res: res.raw,
    meta: {},
  }
}

/**
 * Execute a lifecycle hook if it exists.
 */
async function runHook(
  hooks: Partial<LifecycleHooks> | undefined,
  hookName: keyof LifecycleHooks,
  ctx: HookContext,
  logger?: Logger,
): Promise<void> {
  if (!hooks) return
  const fn = hooks[hookName]
  if (!fn) return
  try {
    await fn(ctx)
  } catch (error: any) {
    if (logger) {
      logger.error(`Hook '${hookName}' failed for '${ctx.collection}': ${error.message}`)
    }
    throw error
  }
}

/**
 * LIST - Get paginated list of documents with filters, sorting, projection.
 */
export async function listDocuments(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, adapter, config, defaults, logger } = opts

  const mongoQuery = buildQuery(req.query, {
    adapter,
    queryConfig: config.query ?? defaults?.query,
    defaultLimit: defaults?.pagination?.limit,
    maxLimit: defaults?.pagination?.maxLimit,
    maxRegexLength: defaults?.security?.maxRegexLength,
  })

  const ctx = createCtx(collectionName, 'find', req, res, { query: mongoQuery })
  await runHook(config.hooks, 'beforeFind', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

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

  const { page, limit } = extractPagination(
    req.query,
    defaults?.pagination?.limit,
    defaults?.pagination?.maxLimit,
  )

  ctx.result = docs
  await runHook(config.hooks, 'afterFind', ctx, logger)

  return {
    statusCode: 200,
    data: ctx.result ?? docs,
    meta: buildPaginationMeta(total, page, limit),
  }
}

/**
 * GET - Get a single document by ID.
 */
export async function getDocument(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, config, logger } = opts
  const { id } = req.params

  // Parse field projection
  let projection: Record<string, 1> | undefined
  if (req.query.fields) {
    const fields = typeof req.query.fields === 'string'
      ? req.query.fields.split(',')
      : req.query.fields
    projection = {}
    for (const f of fields) {
      const trimmed = (f as string).trim()
      if (trimmed && !trimmed.startsWith('$')) {
        projection[trimmed] = 1
      }
    }
  }

  const ctx = createCtx(collectionName, 'find', req, res, { id })
  await runHook(config.hooks, 'beforeFind', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

  let query = model.findById(id)
  if (projection) query = query.select(projection)
  const doc = await query.lean().exec()

  if (!doc) throw new NotFoundError(collectionName, id)

  ctx.result = doc
  await runHook(config.hooks, 'afterFind', ctx, logger)

  return { statusCode: 200, data: ctx.result ?? doc }
}

/**
 * CREATE - Create a new document.
 */
export async function createDocument(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, adapter, config, logger } = opts
  const data = req.body

  const validation = await adapter.validate(data)
  if (!validation.valid) {
    throw new ValidationError('Validation failed', validation.errors)
  }

  const ctx = createCtx(collectionName, 'create', req, res, { data: validation.data ?? data })
  await runHook(config.hooks, 'beforeCreate', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

  const doc = await model.create(ctx.data ?? data)
  const result = doc.toObject()

  ctx.result = result
  await runHook(config.hooks, 'afterCreate', ctx, logger)

  return { statusCode: 201, data: ctx.result ?? result }
}

/**
 * UPDATE - Full replace update by ID.
 */
export async function updateDocument(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, adapter, config, logger } = opts
  const { id } = req.params
  const data = req.body

  const validation = await adapter.validate(data)
  if (!validation.valid) {
    throw new ValidationError('Validation failed', validation.errors)
  }

  const ctx = createCtx(collectionName, 'update', req, res, { id, data: validation.data ?? data })
  await runHook(config.hooks, 'beforeUpdate', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

  const doc = await model
    .findByIdAndUpdate(id, ctx.data ?? data, { new: true, runValidators: true, overwrite: true })
    .lean()
    .exec()

  if (!doc) throw new NotFoundError(collectionName, id)

  ctx.result = doc
  await runHook(config.hooks, 'afterUpdate', ctx, logger)

  return { statusCode: 200, data: ctx.result ?? doc }
}

/**
 * PATCH - Partial update by ID.
 */
export async function patchDocument(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, config, logger } = opts
  const { id } = req.params
  const data = req.body

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationError('Request body must be an object')
  }

  for (const key of Object.keys(data)) {
    if (key.startsWith('$')) {
      throw new ValidationError(`Invalid field name: ${key}`)
    }
  }

  const ctx = createCtx(collectionName, 'patch', req, res, { id, data })
  await runHook(config.hooks, 'beforeUpdate', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

  const doc = await model
    .findByIdAndUpdate(id, { $set: ctx.data ?? data }, { new: true, runValidators: true })
    .lean()
    .exec()

  if (!doc) throw new NotFoundError(collectionName, id)

  ctx.result = doc
  await runHook(config.hooks, 'afterUpdate', ctx, logger)

  return { statusCode: 200, data: ctx.result ?? doc }
}

/**
 * DELETE - Delete a document by ID.
 */
export async function deleteDocument(
  req: MonapiRequest,
  res: MonapiResponse,
  opts: OperationOptions,
): Promise<OperationResult> {
  const { collectionName, model, config, logger } = opts
  const { id } = req.params

  const ctx = createCtx(collectionName, 'delete', req, res, { id })
  await runHook(config.hooks, 'beforeDelete', ctx, logger)
  if (ctx.preventDefault) return { statusCode: 0, data: null }

  const doc = await model.findByIdAndDelete(id).lean().exec()
  if (!doc) throw new NotFoundError(collectionName, id)

  ctx.result = doc
  await runHook(config.hooks, 'afterDelete', ctx, logger)

  return { statusCode: 200, data: ctx.result ?? doc }
}
