import { FilterQuery, SortOrder } from 'mongoose'

/**
 * Supported filter operators for query parameters
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'like'
  | 'exists'

/**
 * Single filter condition with operator and value
 */
export interface FilterCondition {
  operator: FilterOperator
  value: any
}

/**
 * Parsed filters as a map of field names to filter conditions
 */
export interface ParsedFilters {
  [field: string]: FilterCondition
}

/**
 * Query options for list operations
 */
export interface QueryOptions {
  page?: number
  limit?: number
  sort?: string | string[]
  fields?: string | string[]
  [key: string]: any
}

/**
 * MongoDB query object with pagination and projection
 */
export interface MongoQuery {
  filter: FilterQuery<any>
  sort?: { [key: string]: SortOrder }
  skip?: number
  limit?: number
  projection?: { [key: string]: 0 | 1 }
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages?: number
}

/**
 * Query configuration for a collection
 */
export interface QueryConfig {
  allowedFilters?: string[]
  allowedSorts?: string[]
  defaultSort?: string
  defaultLimit?: number
  maxLimit?: number
}

/**
 * Field type enumeration
 */
export enum FieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  ObjectId = 'objectid',
  Array = 'array',
  Object = 'object',
  Mixed = 'mixed',
}
