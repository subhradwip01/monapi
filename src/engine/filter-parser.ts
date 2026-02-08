import { FilterQuery } from 'mongoose'
import { FilterOperator, FieldType, QueryConfig } from '../types'
import { SchemaAdapter } from '../types/schema'
import { BadRequestError } from '../utils/errors'

/**
 * Map of supported double-underscore operators to MongoDB operators
 */
const OPERATOR_MAP: Record<FilterOperator, string> = {
  eq: '$eq',
  ne: '$ne',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  in: '$in',
  nin: '$nin',
  like: '$regex',
  exists: '$exists',
}

/**
 * Reserved query parameters that should not be treated as filters
 */
const RESERVED_PARAMS = new Set(['page', 'limit', 'sort', 'fields', 'filter'])

/**
 * Default security limits
 */
const DEFAULT_MAX_REGEX_LENGTH = 100
const DEFAULT_MAX_FILTERS = 20

interface FilterParserOptions {
  adapter?: SchemaAdapter
  queryConfig?: QueryConfig
  maxRegexLength?: number
  maxFilters?: number
}

/**
 * Parse query string parameters into a MongoDB filter object.
 *
 * Supports three modes:
 * 1. Simple:   ?age=25&role=admin           (equality)
 * 2. Operator: ?age__gt=18&age__lt=29       (double-underscore operators)
 * 3. Advanced: ?filter[age][gt]=18          (bracket syntax)
 */
export function parseFilters(
  query: Record<string, any>,
  options: FilterParserOptions = {},
): FilterQuery<any> {
  const { adapter, queryConfig, maxRegexLength = DEFAULT_MAX_REGEX_LENGTH, maxFilters = DEFAULT_MAX_FILTERS } = options

  const allowedFields = queryConfig?.allowedFilters ?? adapter?.getFields()
  const filter: FilterQuery<any> = {}
  let filterCount = 0

  // 1. Parse advanced bracket syntax: filter[field][operator]=value
  if (query.filter && typeof query.filter === 'object') {
    for (const [field, ops] of Object.entries(query.filter)) {
      validateField(field, allowedFields)

      if (typeof ops === 'object' && ops !== null) {
        for (const [op, val] of Object.entries(ops as Record<string, any>)) {
          if (++filterCount > maxFilters) {
            throw new BadRequestError(`Too many filters. Maximum allowed: ${maxFilters}`)
          }
          const operator = op as FilterOperator
          validateOperator(operator)
          const fieldType = adapter?.getFieldType(field)
          applyFilter(filter, field, operator, val as string, fieldType, maxRegexLength)
        }
      } else {
        // filter[field]=value (equality shorthand)
        if (++filterCount > maxFilters) {
          throw new BadRequestError(`Too many filters. Maximum allowed: ${maxFilters}`)
        }
        const fieldType = adapter?.getFieldType(field)
        applyFilter(filter, field, 'eq', ops as string, fieldType, maxRegexLength)
      }
    }
  }

  // 2. Parse simple and operator params: field=value or field__op=value
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key) || key === 'filter') continue
    if (value === undefined || value === '') continue

    const { field, operator } = parseParamKey(key)

    validateField(field, allowedFields)
    if (++filterCount > maxFilters) {
      throw new BadRequestError(`Too many filters. Maximum allowed: ${maxFilters}`)
    }
    validateOperator(operator)

    const fieldType = adapter?.getFieldType(field)
    applyFilter(filter, field, operator, value, fieldType, maxRegexLength)
  }

  return filter
}

/**
 * Parse a query parameter key into field name and operator.
 * e.g. "age__gt" -> { field: "age", operator: "gt" }
 * e.g. "role"    -> { field: "role", operator: "eq" }
 */
function parseParamKey(key: string): { field: string; operator: FilterOperator } {
  const doubleUnderscoreIndex = key.indexOf('__')

  if (doubleUnderscoreIndex === -1) {
    return { field: key, operator: 'eq' }
  }

  const field = key.substring(0, doubleUnderscoreIndex)
  const operator = key.substring(doubleUnderscoreIndex + 2) as FilterOperator

  return { field, operator }
}

/**
 * Validate that a field is allowed for filtering
 */
function validateField(field: string, allowedFields?: string[]): void {
  // Block MongoDB operators and injection attempts
  if (field.startsWith('$')) {
    throw new BadRequestError(`Invalid filter field: ${field}`)
  }

  if (allowedFields && !allowedFields.includes(field)) {
    throw new BadRequestError(`Filtering on field '${field}' is not allowed`)
  }
}

/**
 * Validate that an operator is supported
 */
function validateOperator(operator: FilterOperator): void {
  if (!(operator in OPERATOR_MAP)) {
    throw new BadRequestError(
      `Unsupported filter operator: '${operator}'. Supported: ${Object.keys(OPERATOR_MAP).join(', ')}`,
    )
  }
}

/**
 * Apply a single filter condition to the filter object
 */
function applyFilter(
  filter: FilterQuery<any>,
  field: string,
  operator: FilterOperator,
  rawValue: string,
  fieldType?: FieldType,
  maxRegexLength?: number,
): void {
  const mongoOp = OPERATOR_MAP[operator]
  const value = coerceValue(rawValue, operator, fieldType, maxRegexLength)

  if (operator === 'eq') {
    // Simple equality - don't nest in $eq for cleaner queries
    filter[field] = value
  } else {
    if (!filter[field] || typeof filter[field] !== 'object') {
      filter[field] = {}
    }
    filter[field][mongoOp] = value
  }
}

/**
 * Coerce string values from query params to appropriate types
 */
function coerceValue(
  raw: string,
  operator: FilterOperator,
  fieldType?: FieldType,
  maxRegexLength = DEFAULT_MAX_REGEX_LENGTH,
): any {
  // Handle array operators
  if (operator === 'in' || operator === 'nin') {
    const items = String(raw).split(',').map((s) => s.trim())
    return items.map((item) => coerceSingleValue(item, fieldType))
  }

  // Handle exists operator
  if (operator === 'exists') {
    return raw === 'true' || raw === '1'
  }

  // Handle like operator (regex)
  if (operator === 'like') {
    const pattern = String(raw)
    if (pattern.length > maxRegexLength) {
      throw new BadRequestError(
        `Regex pattern too long. Maximum length: ${maxRegexLength}`,
      )
    }
    // Escape special regex characters for safety, then make it a partial match
    const escaped = escapeRegex(pattern)
    return new RegExp(escaped, 'i')
  }

  return coerceSingleValue(raw, fieldType)
}

/**
 * Coerce a single value based on field type
 */
function coerceSingleValue(raw: string, fieldType?: FieldType): any {
  const str = String(raw)

  // If we know the field type, coerce accordingly
  if (fieldType) {
    switch (fieldType) {
      case FieldType.Number:
        const num = Number(str)
        if (!isNaN(num)) return num
        break
      case FieldType.Boolean:
        if (str === 'true' || str === '1') return true
        if (str === 'false' || str === '0') return false
        break
      case FieldType.Date:
        const date = new Date(str)
        if (!isNaN(date.getTime())) return date
        break
    }
  }

  // Auto-detect types if field type not known
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return Number(str)
  }

  // Booleans
  if (str === 'true') return true
  if (str === 'false') return false

  // ISO dates
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(str)) {
    const date = new Date(str)
    if (!isNaN(date.getTime())) return date
  }

  return str
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
