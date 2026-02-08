import { Model, Schema } from 'mongoose'
import { SchemaAdapter, SchemaType } from '../../types'
import { MongooseAdapter } from './MongooseAdapter'

/**
 * Detect the type of schema provided
 */
export function detectSchemaType(schema: any): SchemaType {
  // Check if it's a Mongoose schema
  if (schema instanceof Schema) {
    return SchemaType.Mongoose
  }

  // Check if it's a Mongoose model
  if (typeof schema === 'function' && schema.prototype && schema.schema) {
    return SchemaType.Mongoose
  }

  // Check for Zod schema
  if (schema && typeof schema === 'object' && '_def' in schema && 'parse' in schema) {
    return SchemaType.Zod
  }

  // Check for Joi schema
  if (schema && typeof schema === 'object' && 'isJoi' in schema) {
    return SchemaType.Joi
  }

  // Check for Yup schema
  if (schema && typeof schema === 'object' && '__isYupSchema__' in schema) {
    return SchemaType.Yup
  }

  // Check for Typegoose class
  if (typeof schema === 'function' && schema.prototype) {
    // Typegoose classes typically have metadata
    const metadata = (Reflect as any).getMetadata?.('typegoose:properties', schema)
    if (metadata) {
      return SchemaType.Typegoose
    }
  }

  return SchemaType.Unknown
}

/**
 * Create appropriate schema adapter based on schema type
 */
export function createSchemaAdapter(schema: Schema | Model<any> | any): SchemaAdapter {
  const schemaType = detectSchemaType(schema)

  switch (schemaType) {
    case SchemaType.Mongoose:
      return new MongooseAdapter(schema)

    case SchemaType.Zod:
      throw new Error('Zod adapter not yet implemented. Coming in Phase 9.')

    case SchemaType.Joi:
      throw new Error('Joi adapter not yet implemented. Coming in Phase 9.')

    case SchemaType.Yup:
      throw new Error('Yup adapter not yet implemented. Coming in Phase 9.')

    case SchemaType.Typegoose:
      throw new Error('Typegoose adapter not yet implemented. Coming in Phase 9.')

    default:
      throw new Error(`Unsupported schema type: ${schemaType}`)
  }
}

/**
 * Validate that a schema is supported
 */
export function isSupportedSchema(schema: any): boolean {
  const schemaType = detectSchemaType(schema)
  return schemaType !== SchemaType.Unknown
}

// Re-export adapters
export { MongooseAdapter }
