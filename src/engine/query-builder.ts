import { SortOrder } from 'mongoose'
import { MongoQuery, QueryConfig, PaginationMeta } from '../types'
import { SchemaAdapter } from '../types/schema'
import { parseFilters } from './filter-parser'
import { BadRequestError } from '../utils/errors'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const DEFAULT_MAX_LIMIT = 100

interface QueryBuilderOptions {
  adapter?: SchemaAdapter
  queryConfig?: QueryConfig
  defaultLimit?: number
  maxLimit?: number
  maxRegexLength?: number
}

/**
 * Build a complete MongoDB query from Express request query parameters.
 * Handles filters, sorting, pagination, and field projection.
 */
export function buildQuery(
  queryParams: Record<string, any>,
  options: QueryBuilderOptions = {},
): MongoQuery {
  const {
    adapter,
    queryConfig,
    defaultLimit = queryConfig?.defaultLimit ?? DEFAULT_LIMIT,
    maxLimit = queryConfig?.maxLimit ?? DEFAULT_MAX_LIMIT,
    maxRegexLength,
  } = options

  const filter = parseFilters(queryParams, { adapter, queryConfig, maxRegexLength })
  const sort = parseSort(queryParams.sort, queryConfig, adapter)
  const { skip, limit } = parsePagination(queryParams, defaultLimit, maxLimit)
  const projection = parseProjection(queryParams.fields, adapter)

  const mongoQuery: MongoQuery = { filter }

  if (Object.keys(sort).length > 0) {
    mongoQuery.sort = sort
  }

  mongoQuery.skip = skip
  mongoQuery.limit = limit

  if (projection && Object.keys(projection).length > 0) {
    mongoQuery.projection = projection
  }

  return mongoQuery
}

/**
 * Parse sort parameter into MongoDB sort object.
 * Format: "field1,-field2" (prefix with - for descending)
 */
function parseSort(
  sortParam: string | string[] | undefined,
  queryConfig?: QueryConfig,
  adapter?: SchemaAdapter,
): Record<string, SortOrder> {
  const sort: Record<string, SortOrder> = {}

  if (!sortParam && queryConfig?.defaultSort) {
    sortParam = queryConfig.defaultSort
  }

  if (!sortParam) return sort

  const fields = Array.isArray(sortParam)
    ? sortParam
    : sortParam.split(',').map((s) => s.trim())

  const allowedSorts = queryConfig?.allowedSorts ?? adapter?.getFields()

  for (const field of fields) {
    if (!field) continue

    let direction: SortOrder = 1
    let fieldName = field

    if (field.startsWith('-')) {
      direction = -1
      fieldName = field.substring(1)
    }

    // Validate sort field
    if (fieldName.startsWith('$')) {
      throw new BadRequestError(`Invalid sort field: ${fieldName}`)
    }

    if (allowedSorts && !allowedSorts.includes(fieldName)) {
      throw new BadRequestError(`Sorting by '${fieldName}' is not allowed`)
    }

    sort[fieldName] = direction
  }

  return sort
}

/**
 * Parse pagination parameters
 */
function parsePagination(
  queryParams: Record<string, any>,
  defaultLimit: number,
  maxLimit: number,
): { skip: number; limit: number; page: number } {
  let page = parseInt(queryParams.page, 10)
  let limit = parseInt(queryParams.limit, 10)

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE
  if (isNaN(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  const skip = (page - 1) * limit

  return { skip, limit, page }
}

/**
 * Parse field projection parameter.
 * Format: "field1,field2,field3"
 */
function parseProjection(
  fieldsParam: string | string[] | undefined,
  adapter?: SchemaAdapter,
): Record<string, 0 | 1> | undefined {
  if (!fieldsParam) return undefined

  const fields = Array.isArray(fieldsParam)
    ? fieldsParam
    : fieldsParam.split(',').map((s) => s.trim())

  const schemaFields = adapter?.getFields()
  const projection: Record<string, 0 | 1> = {}

  for (const field of fields) {
    if (!field) continue

    if (field.startsWith('$')) {
      throw new BadRequestError(`Invalid projection field: ${field}`)
    }

    // Only allow projection on schema fields if adapter is available
    if (schemaFields && !schemaFields.includes(field)) {
      throw new BadRequestError(`Field '${field}' does not exist in schema`)
    }

    projection[field] = 1
  }

  return Object.keys(projection).length > 0 ? projection : undefined
}

/**
 * Build pagination metadata from query results
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Extract page and limit from query params (for use in handlers)
 */
export function extractPagination(
  queryParams: Record<string, any>,
  defaultLimit = DEFAULT_LIMIT,
  maxLimit = DEFAULT_MAX_LIMIT,
): { page: number; limit: number } {
  let page = parseInt(queryParams.page, 10)
  let limit = parseInt(queryParams.limit, 10)

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE
  if (isNaN(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  return { page, limit }
}
