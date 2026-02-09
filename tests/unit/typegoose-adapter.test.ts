import mongoose, { Schema } from 'mongoose'
import { FieldType } from '../../src/types/query'

// Create the test model outside the mock factory
const testSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number },
  active: { type: Boolean, default: true },
  role: { type: String, enum: ['admin', 'user'] },
})

const modelName = 'TypegooseTestModel_' + Date.now()
const TestModel = mongoose.model(modelName, testSchema)

const mockGetModelForClass = jest.fn().mockReturnValue(TestModel)

// Mock @typegoose/typegoose as a virtual module (not installed)
jest.mock(
  '@typegoose/typegoose',
  () => ({
    getModelForClass: mockGetModelForClass,
  }),
  { virtual: true }
)

// Import after mock is set up
import { TypegooseAdapter } from '../../src/adapters/schema/TypegooseAdapter'

describe('TypegooseAdapter', () => {
  // Simulate a Typegoose class
  class UserClass {
    public name!: string
    public email!: string
    public age?: number
    public active?: boolean
    public role?: string
  }

  let adapter: TypegooseAdapter

  beforeEach(() => {
    mockGetModelForClass.mockClear()
    mockGetModelForClass.mockReturnValue(TestModel)
    adapter = new TypegooseAdapter(UserClass)
  })

  describe('constructor', () => {
    it('should create adapter from a Typegoose class', () => {
      expect(adapter).toBeInstanceOf(TypegooseAdapter)
    })

    it('should call getModelForClass with the class', () => {
      expect(mockGetModelForClass).toHaveBeenCalledWith(UserClass)
    })

    it('should pass existingConnection option when provided', () => {
      mockGetModelForClass.mockClear()

      const fakeConnection = { name: 'test-connection' }
      new TypegooseAdapter(UserClass, { existingConnection: fakeConnection })

      expect(mockGetModelForClass).toHaveBeenCalledWith(UserClass, {
        existingConnection: fakeConnection,
      })
    })

    it('should throw if getModelForClass fails', () => {
      mockGetModelForClass.mockImplementationOnce(() => {
        throw new Error('Module not found')
      })

      expect(() => new TypegooseAdapter(UserClass)).toThrow(
        /Failed to create model from Typegoose class/
      )
    })
  })

  describe('getFields', () => {
    it('should return all field names from the generated model', () => {
      const fields = adapter.getFields()
      expect(fields).toContain('name')
      expect(fields).toContain('email')
      expect(fields).toContain('age')
      expect(fields).toContain('active')
      expect(fields).toContain('role')
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
      expect(meta!.enum).toEqual(['admin', 'user'])
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
    it('should delegate validation to inner MongooseAdapter', async () => {
      const result = await adapter.validate({ name: 'John', email: 'john@test.com' })
      expect(result.valid).toBe(true)
    })

    it('should return invalid for missing required fields', async () => {
      const result = await adapter.validate({ age: 25 })
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('getMongooseModel', () => {
    it('should return the underlying Mongoose model', () => {
      const model = adapter.getMongooseModel()
      expect(model).toBeDefined()
      expect(typeof model!.findOne).toBe('function')
    })
  })

  describe('getMongooseSchema', () => {
    it('should return the underlying Mongoose schema', () => {
      const schema = adapter.getMongooseSchema()
      expect(schema).toBeDefined()
      expect(schema).toBeInstanceOf(Schema)
    })
  })

  describe('getTypegooseClass', () => {
    it('should return the original Typegoose class', () => {
      expect(adapter.getTypegooseClass()).toBe(UserClass)
    })
  })
})
