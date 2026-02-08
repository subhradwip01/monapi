import { Schema } from 'mongoose'
import { detectSchemaType, createSchemaAdapter, isSupportedSchema } from '../../src/adapters/schema'
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

  it('should detect Zod-like schema', () => {
    const zodLike = { _def: {}, parse: () => {} }
    expect(detectSchemaType(zodLike)).toBe(SchemaType.Zod)
  })

  it('should detect Joi-like schema', () => {
    const joiLike = { isJoi: true }
    expect(detectSchemaType(joiLike)).toBe(SchemaType.Joi)
  })

  it('should detect Yup-like schema', () => {
    const yupLike = { __isYupSchema__: true }
    expect(detectSchemaType(yupLike)).toBe(SchemaType.Yup)
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

  it('should throw for Zod (not yet implemented)', () => {
    const zodLike = { _def: {}, parse: () => {} }
    expect(() => createSchemaAdapter(zodLike)).toThrow(/Zod/)
  })
})

describe('isSupportedSchema', () => {
  it('should return true for Mongoose schema', () => {
    const schema = new Schema({ name: String })
    expect(isSupportedSchema(schema)).toBe(true)
  })

  it('should return false for unknown objects', () => {
    expect(isSupportedSchema({ foo: 'bar' })).toBe(false)
  })
})
