import { buildQuery, buildPaginationMeta, extractPagination } from '../../src/engine/query-builder'
import { BadRequestError } from '../../src/utils/errors'
import { FieldType } from '../../src/types/query'
import { SchemaAdapter } from '../../src/types/schema'

function createMockAdapter(fields: string[]): SchemaAdapter {
  return {
    getFields: () => fields,
    getFieldType: () => FieldType.String,
    getFieldMetadata: () => undefined,
    getAllFieldsMetadata: () => [],
    validate: () => ({ valid: true }),
  }
}

describe('buildQuery', () => {
  describe('filters', () => {
    it('should pass through filters from query params', () => {
      const result = buildQuery({ name: 'john' })
      expect(result.filter).toEqual({ name: 'john' })
    })

    it('should exclude reserved params from filters', () => {
      const result = buildQuery({ name: 'john', page: '1', limit: '10', sort: 'name', fields: 'name' })
      expect(result.filter).toEqual({ name: 'john' })
    })
  })

  describe('sorting', () => {
    it('should parse ascending sort', () => {
      const result = buildQuery({ sort: 'name' })
      expect(result.sort).toEqual({ name: 1 })
    })

    it('should parse descending sort with - prefix', () => {
      const result = buildQuery({ sort: '-createdAt' })
      expect(result.sort).toEqual({ createdAt: -1 })
    })

    it('should parse multiple sort fields', () => {
      const result = buildQuery({ sort: 'age,-createdAt' })
      expect(result.sort).toEqual({ age: 1, createdAt: -1 })
    })

    it('should use defaultSort from queryConfig', () => {
      const result = buildQuery({}, { queryConfig: { defaultSort: '-createdAt' } })
      expect(result.sort).toEqual({ createdAt: -1 })
    })

    it('should not set sort if no sort param and no default', () => {
      const result = buildQuery({})
      expect(result.sort).toBeUndefined()
    })

    it('should reject sort fields starting with $', () => {
      expect(() => buildQuery({ sort: '$bad' })).toThrow(BadRequestError)
    })

    it('should reject sort on disallowed fields', () => {
      const adapter = createMockAdapter(['name', 'age'])
      expect(() =>
        buildQuery({ sort: 'secret' }, { adapter, queryConfig: { allowedSorts: ['name', 'age'] } }),
      ).toThrow(BadRequestError)
    })
  })

  describe('pagination', () => {
    it('should default to page 1 and limit 10', () => {
      const result = buildQuery({})
      expect(result.skip).toBe(0)
      expect(result.limit).toBe(10)
    })

    it('should parse page and limit from params', () => {
      const result = buildQuery({ page: '2', limit: '20' })
      expect(result.skip).toBe(20) // (2-1) * 20
      expect(result.limit).toBe(20)
    })

    it('should use custom default limit', () => {
      const result = buildQuery({}, { defaultLimit: 25 })
      expect(result.limit).toBe(25)
    })

    it('should cap limit at maxLimit', () => {
      const result = buildQuery({ limit: '500' }, { maxLimit: 100 })
      expect(result.limit).toBe(100)
    })

    it('should use defaultLimit from queryConfig', () => {
      const result = buildQuery({}, { queryConfig: { defaultLimit: 15 } })
      expect(result.limit).toBe(15)
    })

    it('should use maxLimit from queryConfig', () => {
      const result = buildQuery({ limit: '500' }, { queryConfig: { maxLimit: 50 } })
      expect(result.limit).toBe(50)
    })

    it('should default page to 1 for invalid values', () => {
      const result = buildQuery({ page: '-1' })
      expect(result.skip).toBe(0)
    })

    it('should default limit for invalid values', () => {
      const result = buildQuery({ limit: 'abc' })
      expect(result.limit).toBe(10)
    })
  })

  describe('projection', () => {
    it('should parse fields param as projection', () => {
      const result = buildQuery({ fields: 'name,email' })
      expect(result.projection).toEqual({ name: 1, email: 1 })
    })

    it('should not set projection if no fields param', () => {
      const result = buildQuery({})
      expect(result.projection).toBeUndefined()
    })

    it('should reject fields starting with $', () => {
      expect(() => buildQuery({ fields: '$secret' })).toThrow(BadRequestError)
    })

    it('should reject fields not in schema', () => {
      const adapter = createMockAdapter(['name', 'email'])
      expect(() => buildQuery({ fields: 'name,password' }, { adapter })).toThrow(BadRequestError)
    })

    it('should trim field names', () => {
      const result = buildQuery({ fields: ' name , email ' })
      expect(result.projection).toEqual({ name: 1, email: 1 })
    })
  })

  describe('full query', () => {
    it('should build a complete query with all options', () => {
      const result = buildQuery({
        name: 'john',
        age__gt: '18',
        sort: '-createdAt',
        page: '2',
        limit: '20',
        fields: 'name,email,age',
      })

      expect(result.filter).toEqual({ name: 'john', age: { $gt: 18 } })
      expect(result.sort).toEqual({ createdAt: -1 })
      expect(result.skip).toBe(20)
      expect(result.limit).toBe(20)
      expect(result.projection).toEqual({ name: 1, email: 1, age: 1 })
    })
  })
})

describe('buildPaginationMeta', () => {
  it('should build pagination metadata', () => {
    const meta = buildPaginationMeta(100, 2, 20)
    expect(meta).toEqual({
      page: 2,
      limit: 20,
      total: 100,
      totalPages: 5,
    })
  })

  it('should round up totalPages', () => {
    const meta = buildPaginationMeta(21, 1, 10)
    expect(meta.totalPages).toBe(3)
  })

  it('should handle zero total', () => {
    const meta = buildPaginationMeta(0, 1, 10)
    expect(meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    })
  })
})

describe('extractPagination', () => {
  it('should extract page and limit', () => {
    const result = extractPagination({ page: '3', limit: '15' })
    expect(result).toEqual({ page: 3, limit: 15 })
  })

  it('should use defaults for missing params', () => {
    const result = extractPagination({})
    expect(result).toEqual({ page: 1, limit: 10 })
  })

  it('should cap limit at maxLimit', () => {
    const result = extractPagination({ limit: '200' }, 10, 50)
    expect(result.limit).toBe(50)
  })
})
