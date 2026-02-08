import { parseFilters } from '../../src/engine/filter-parser'
import { BadRequestError } from '../../src/utils/errors'
import { FieldType } from '../../src/types/query'
import { SchemaAdapter } from '../../src/types/schema'

// Mock schema adapter for testing
function createMockAdapter(fields: string[], fieldTypes: Record<string, FieldType> = {}): SchemaAdapter {
  return {
    getFields: () => fields,
    getFieldType: (field: string) => fieldTypes[field] ?? FieldType.String,
    getFieldMetadata: () => undefined,
    getAllFieldsMetadata: () => [],
    validate: () => ({ valid: true }),
  }
}

describe('parseFilters', () => {
  describe('simple equality', () => {
    it('should parse simple key=value as equality filter', () => {
      const result = parseFilters({ name: 'john' })
      expect(result).toEqual({ name: 'john' })
    })

    it('should parse multiple equality filters', () => {
      const result = parseFilters({ name: 'john', role: 'admin' })
      expect(result).toEqual({ name: 'john', role: 'admin' })
    })

    it('should skip empty values', () => {
      const result = parseFilters({ name: 'john', role: '' })
      expect(result).toEqual({ name: 'john' })
    })

    it('should skip undefined values', () => {
      const result = parseFilters({ name: 'john', role: undefined })
      expect(result).toEqual({ name: 'john' })
    })

    it('should skip reserved params (page, limit, sort, fields)', () => {
      const result = parseFilters({ name: 'john', page: '1', limit: '10', sort: 'name', fields: 'name,email' })
      expect(result).toEqual({ name: 'john' })
    })
  })

  describe('auto type coercion', () => {
    it('should coerce numeric strings to numbers', () => {
      const result = parseFilters({ age: '25' })
      expect(result).toEqual({ age: 25 })
    })

    it('should coerce negative numbers', () => {
      const result = parseFilters({ score: '-5' })
      expect(result).toEqual({ score: -5 })
    })

    it('should coerce decimal numbers', () => {
      const result = parseFilters({ price: '19.99' })
      expect(result).toEqual({ price: 19.99 })
    })

    it('should coerce "true" to boolean true', () => {
      const result = parseFilters({ active: 'true' })
      expect(result).toEqual({ active: true })
    })

    it('should coerce "false" to boolean false', () => {
      const result = parseFilters({ active: 'false' })
      expect(result).toEqual({ active: false })
    })

    it('should coerce ISO date strings to Date objects', () => {
      const result = parseFilters({ createdAt: '2024-01-15' })
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should coerce ISO datetime strings to Date objects', () => {
      const result = parseFilters({ createdAt: '2024-01-15T10:30:00' })
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should keep non-numeric strings as strings', () => {
      const result = parseFilters({ name: 'hello' })
      expect(result).toEqual({ name: 'hello' })
    })
  })

  describe('type-aware coercion with adapter', () => {
    it('should coerce to number when field type is Number', () => {
      const adapter = createMockAdapter(['age'], { age: FieldType.Number })
      const result = parseFilters({ age: '25' }, { adapter })
      expect(result).toEqual({ age: 25 })
    })

    it('should coerce to boolean when field type is Boolean', () => {
      const adapter = createMockAdapter(['active'], { active: FieldType.Boolean })
      const result = parseFilters({ active: '1' }, { adapter })
      expect(result).toEqual({ active: true })
    })

    it('should coerce to Date when field type is Date', () => {
      const adapter = createMockAdapter(['createdAt'], { createdAt: FieldType.Date })
      const result = parseFilters({ createdAt: '2024-01-15' }, { adapter })
      expect(result.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('double-underscore operators', () => {
    it('should parse __gt operator', () => {
      const result = parseFilters({ age__gt: '18' })
      expect(result).toEqual({ age: { $gt: 18 } })
    })

    it('should parse __gte operator', () => {
      const result = parseFilters({ age__gte: '18' })
      expect(result).toEqual({ age: { $gte: 18 } })
    })

    it('should parse __lt operator', () => {
      const result = parseFilters({ age__lt: '30' })
      expect(result).toEqual({ age: { $lt: 30 } })
    })

    it('should parse __lte operator', () => {
      const result = parseFilters({ age__lte: '30' })
      expect(result).toEqual({ age: { $lte: 30 } })
    })

    it('should parse __ne operator', () => {
      const result = parseFilters({ role__ne: 'admin' })
      expect(result).toEqual({ role: { $ne: 'admin' } })
    })

    it('should parse __in operator with comma-separated values', () => {
      const result = parseFilters({ role__in: 'admin,user' })
      expect(result).toEqual({ role: { $in: ['admin', 'user'] } })
    })

    it('should parse __nin operator', () => {
      const result = parseFilters({ role__nin: 'banned,suspended' })
      expect(result).toEqual({ role: { $nin: ['banned', 'suspended'] } })
    })

    it('should parse __exists operator', () => {
      const result = parseFilters({ email__exists: 'true' })
      expect(result).toEqual({ email: { $exists: true } })
    })

    it('should parse __exists=false', () => {
      const result = parseFilters({ email__exists: 'false' })
      expect(result).toEqual({ email: { $exists: false } })
    })

    it('should parse __like operator as case-insensitive regex', () => {
      const result = parseFilters({ name__like: 'john' })
      expect(result.name).toEqual({ $regex: expect.any(RegExp) })
      expect(result.name.$regex.flags).toBe('i')
    })

    it('should combine multiple operators on the same field', () => {
      const result = parseFilters({ age__gt: '18', age__lt: '30' })
      expect(result).toEqual({ age: { $gt: 18, $lt: 30 } })
    })
  })

  describe('advanced bracket syntax', () => {
    it('should parse filter[field][operator]=value', () => {
      const result = parseFilters({ filter: { age: { gt: '18' } } })
      expect(result).toEqual({ age: { $gt: 18 } })
    })

    it('should parse filter[field]=value as equality', () => {
      const result = parseFilters({ filter: { role: 'admin' } })
      expect(result).toEqual({ role: 'admin' })
    })

    it('should handle multiple advanced filters', () => {
      const result = parseFilters({ filter: { age: { gt: '18', lt: '30' } } })
      expect(result).toEqual({ age: { $gt: 18, $lt: 30 } })
    })
  })

  describe('security', () => {
    it('should reject fields starting with $', () => {
      expect(() => parseFilters({ $where: '1' })).toThrow(BadRequestError)
    })

    it('should reject fields not in allowedFilters', () => {
      const adapter = createMockAdapter(['name', 'age'])
      expect(() =>
        parseFilters({ secret: 'value' }, { adapter, queryConfig: { allowedFilters: ['name', 'age'] } }),
      ).toThrow(BadRequestError)
    })

    it('should allow fields in allowedFilters', () => {
      const adapter = createMockAdapter(['name', 'age'])
      const result = parseFilters(
        { name: 'john' },
        { adapter, queryConfig: { allowedFilters: ['name', 'age'] } },
      )
      expect(result).toEqual({ name: 'john' })
    })

    it('should reject unsupported operators', () => {
      expect(() => parseFilters({ age__badop: '5' })).toThrow(BadRequestError)
    })

    it('should reject regex patterns that are too long', () => {
      const longPattern = 'a'.repeat(200)
      expect(() => parseFilters({ name__like: longPattern }, { maxRegexLength: 100 })).toThrow(BadRequestError)
    })

    it('should escape special regex characters in __like', () => {
      const result = parseFilters({ name__like: 'test.+' })
      // The regex should have the special chars escaped
      expect(result.name.$regex.source).toContain('\\.')
      expect(result.name.$regex.source).toContain('\\+')
    })

    it('should reject too many filters', () => {
      const query: Record<string, string> = {}
      for (let i = 0; i < 25; i++) {
        query[`field${i}`] = 'value'
      }
      expect(() => parseFilters(query, { maxFilters: 20 })).toThrow(BadRequestError)
    })
  })
})
