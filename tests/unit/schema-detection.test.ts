import { Schema } from 'mongoose'
import { detectSchemaType, createSchemaAdapter } from '../../src/adapters/schema'
import { SchemaType } from '../../src/types/schema'
import { MongooseAdapter } from '../../src/adapters/schema/MongooseAdapter'

describe('detectSchemaType', () => {
  it('should detect Mongoose Schema', () => {
    const schema = new Schema({ name: String })
    expect(detectSchemaType(schema)).toBe(SchemaType.Mongoose)
  })

  it('should return Unknown for plain objects', () => {
    expect(detectSchemaType({ name: 'string' })).toBe(SchemaType.Unknown)
  })

  it('should return Unknown for null', () => {
    expect(detectSchemaType(null)).toBe(SchemaType.Unknown)
  })

  it('should return Unknown for undefined', () => {
    expect(detectSchemaType(undefined)).toBe(SchemaType.Unknown)
  })

  it('should return Unknown for strings', () => {
    expect(detectSchemaType('schema')).toBe(SchemaType.Unknown)
  })

  it('should detect Typegoose class with Reflect metadata', () => {
    // Simulate a Typegoose class with Reflect metadata
    class FakeTypegooseClass {}
    const R = Reflect as any
    const originalGetMetadata = R.getMetadata

    // Temporarily mock Reflect.getMetadata
    R.getMetadata = (key: string, target: any) => {
      if (key === 'typegoose:properties' && target === FakeTypegooseClass.prototype) {
        return new Map([['name', { type: String }]])
      }
      return originalGetMetadata?.call(Reflect, key, target)
    }

    expect(detectSchemaType(FakeTypegooseClass)).toBe(SchemaType.Typegoose)

    // Restore
    R.getMetadata = originalGetMetadata
  })

  it('should return Unknown for class without Typegoose metadata', () => {
    class PlainClass {}
    expect(detectSchemaType(PlainClass)).toBe(SchemaType.Unknown)
  })
})

describe('createSchemaAdapter', () => {
  it('should create MongooseAdapter for Mongoose schema', () => {
    const schema = new Schema({ name: String })
    const adapter = createSchemaAdapter(schema)
    expect(adapter).toBeInstanceOf(MongooseAdapter)
  })

  it('should throw for unsupported schema types', () => {
    expect(() => createSchemaAdapter({ random: true })).toThrow()
  })
})
