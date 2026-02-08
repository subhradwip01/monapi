import mongoose, { Schema } from 'mongoose'
import { MongooseAdapter } from '../../src/adapters/schema/MongooseAdapter'
import { FieldType } from '../../src/types/query'

describe('MongooseAdapter', () => {
  const testSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    age: { type: Number },
    active: { type: Boolean, default: true },
    role: { type: String, enum: ['admin', 'user', 'moderator'] },
    createdAt: { type: Date, default: Date.now },
    tags: [{ type: String }],
    metadata: { type: Schema.Types.Mixed },
  })

  let adapter: MongooseAdapter

  beforeEach(() => {
    adapter = new MongooseAdapter(testSchema)
  })

  describe('getFields', () => {
    it('should return all field names', () => {
      const fields = adapter.getFields()
      expect(fields).toContain('name')
      expect(fields).toContain('email')
      expect(fields).toContain('age')
      expect(fields).toContain('active')
      expect(fields).toContain('role')
      expect(fields).toContain('createdAt')
      expect(fields).toContain('tags')
      expect(fields).toContain('metadata')
    })

    it('should exclude _id and __v', () => {
      const fields = adapter.getFields()
      expect(fields).not.toContain('_id')
      expect(fields).not.toContain('__v')
    })
  })

  describe('getFieldType', () => {
    it('should return String for string fields', () => {
      expect(adapter.getFieldType('name')).toBe(FieldType.String)
    })

    it('should return Number for number fields', () => {
      expect(adapter.getFieldType('age')).toBe(FieldType.Number)
    })

    it('should return Boolean for boolean fields', () => {
      expect(adapter.getFieldType('active')).toBe(FieldType.Boolean)
    })

    it('should return Date for date fields', () => {
      expect(adapter.getFieldType('createdAt')).toBe(FieldType.Date)
    })

    it('should return Array for array fields', () => {
      expect(adapter.getFieldType('tags')).toBe(FieldType.Array)
    })

    it('should return Mixed for mixed fields', () => {
      expect(adapter.getFieldType('metadata')).toBe(FieldType.Mixed)
    })

    it('should return Mixed for unknown fields', () => {
      expect(adapter.getFieldType('nonexistent')).toBe(FieldType.Mixed)
    })
  })

  describe('getFieldMetadata', () => {
    it('should return metadata for a field', () => {
      const meta = adapter.getFieldMetadata('name')
      expect(meta).toBeDefined()
      expect(meta!.name).toBe('name')
      expect(meta!.type).toBe(FieldType.String)
      expect(meta!.required).toBe(true)
    })

    it('should include enum values', () => {
      const meta = adapter.getFieldMetadata('role')
      expect(meta).toBeDefined()
      expect(meta!.enum).toEqual(['admin', 'user', 'moderator'])
    })

    it('should return undefined for non-existent field', () => {
      const meta = adapter.getFieldMetadata('nonexistent')
      expect(meta).toBeUndefined()
    })
  })

  describe('getAllFieldsMetadata', () => {
    it('should return metadata for all fields', () => {
      const allMeta = adapter.getAllFieldsMetadata()
      expect(allMeta.length).toBeGreaterThan(0)
      const names = allMeta.map((m) => m.name)
      expect(names).toContain('name')
      expect(names).toContain('email')
      expect(names).toContain('age')
    })
  })

  describe('validate', () => {
    it('should return valid:false for non-object data (basic validation)', () => {
      // Without a model, basic validation is used
      const result = adapter.validate('not an object')
      // Since validate can return Promise or sync, handle both
      return Promise.resolve(result).then((r) => {
        expect(r.valid).toBe(false)
      })
    })

    it('should return valid:true for valid object (basic validation)', () => {
      const result = adapter.validate({ name: 'John', email: 'john@test.com' })
      return Promise.resolve(result).then((r) => {
        expect(r.valid).toBe(true)
      })
    })

    it('should return valid:false for null data', () => {
      const result = adapter.validate(null)
      return Promise.resolve(result).then((r) => {
        expect(r.valid).toBe(false)
      })
    })
  })

  describe('getMongooseSchema', () => {
    it('should return the underlying schema', () => {
      const schema = adapter.getMongooseSchema()
      expect(schema).toBe(testSchema)
    })
  })

  describe('getMongooseModel', () => {
    it('should return undefined when constructed from schema', () => {
      const model = adapter.getMongooseModel()
      expect(model).toBeUndefined()
    })
  })

  describe('constructed from Model', () => {
    it('should extract schema from model', () => {
      // Create a model to test with
      const modelSchema = new Schema({ title: { type: String, required: true } })
      const TestModel = mongoose.model('TestAdapterModel_' + Date.now(), modelSchema)

      const modelAdapter = new MongooseAdapter(TestModel)
      expect(modelAdapter.getFields()).toContain('title')
      expect(modelAdapter.getMongooseModel()).toBe(TestModel)
      expect(modelAdapter.getMongooseSchema()).toBe(modelSchema)
    })
  })
})
