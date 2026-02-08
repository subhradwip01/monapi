import { Model, Schema } from 'mongoose'
import {
  SchemaAdapter,
  ValidationResult,
  FieldMetadata,
  FieldType,
} from '../../types'

/**
 * Schema adapter for Mongoose schemas and models
 */
export class MongooseAdapter implements SchemaAdapter {
  private schema: Schema
  private model?: Model<any>

  constructor(schemaOrModel: Schema | Model<any>) {
    if (this.isModel(schemaOrModel)) {
      this.model = schemaOrModel
      this.schema = schemaOrModel.schema
    } else {
      this.schema = schemaOrModel
    }
  }

  /**
   * Type guard to check if value is a Mongoose model
   */
  private isModel(value: any): value is Model<any> {
    return value && typeof value === 'function' && value.prototype && value.schema
  }

  /**
   * Get list of all field names in the schema
   */
  getFields(): string[] {
    const fields: string[] = []

    this.schema.eachPath((pathname) => {
      // Skip internal mongoose fields
      if (pathname === '_id' || pathname === '__v') {
        return
      }
      fields.push(pathname)
    })

    return fields
  }

  /**
   * Get the type of a specific field
   */
  getFieldType(field: string): FieldType {
    const schemaType = this.schema.path(field)

    if (!schemaType) {
      return FieldType.Mixed
    }

    const instance = schemaType.instance

    switch (instance) {
      case 'String':
        return FieldType.String
      case 'Number':
        return FieldType.Number
      case 'Boolean':
        return FieldType.Boolean
      case 'Date':
        return FieldType.Date
      case 'ObjectID':
      case 'ObjectId':
        return FieldType.ObjectId
      case 'Array':
        return FieldType.Array
      case 'Embedded':
      case 'Subdocument':
        return FieldType.Object
      case 'Mixed':
        return FieldType.Mixed
      default:
        return FieldType.Mixed
    }
  }

  /**
   * Get metadata for a specific field
   */
  getFieldMetadata(field: string): FieldMetadata | undefined {
    const schemaType = this.schema.path(field)

    if (!schemaType) {
      return undefined
    }

    const metadata: FieldMetadata = {
      name: field,
      type: this.getFieldType(field),
    }

    // Check if field is required
    if (schemaType.isRequired) {
      metadata.required = true
    }

    // Get default value
    const st = schemaType as any
    if (st.defaultValue !== undefined) {
      metadata.default = st.defaultValue
    }

    // Get enum values
    if (st.enumValues && st.enumValues.length > 0) {
      metadata.enum = st.enumValues
    }

    return metadata
  }

  /**
   * Get all fields metadata
   */
  getAllFieldsMetadata(): FieldMetadata[] {
    const fields = this.getFields()
    return fields
      .map((field) => this.getFieldMetadata(field))
      .filter((meta): meta is FieldMetadata => meta !== undefined)
  }

  /**
   * Validate data against the schema
   */
  async validate(data: unknown): Promise<ValidationResult> {
    if (!this.model) {
      // If no model available, do basic type checking
      return this.basicValidation(data)
    }

    try {
      // Create a new document instance
      const doc = new this.model(data)

      // Run validation
      await doc.validate()

      return {
        valid: true,
        data: doc.toObject(),
      }
    } catch (error: any) {
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.keys(error.errors).map((field) => ({
          field,
          message: error.errors[field].message,
          code: error.errors[field].kind,
        }))

        return {
          valid: false,
          errors,
        }
      }

      // Other errors
      return {
        valid: false,
        errors: [
          {
            field: '',
            message: error.message || 'Validation failed',
          },
        ],
      }
    }
  }

  /**
   * Basic validation when model is not available
   */
  private basicValidation(data: unknown): ValidationResult {
    if (typeof data !== 'object' || data === null) {
      return {
        valid: false,
        errors: [
          {
            field: '',
            message: 'Data must be an object',
          },
        ],
      }
    }

    return {
      valid: true,
      data,
    }
  }

  /**
   * Get the underlying Mongoose model if available
   */
  getMongooseModel(): Model<any> | undefined {
    return this.model
  }

  /**
   * Get the underlying Mongoose schema
   */
  getMongooseSchema(): Schema {
    return this.schema
  }
}
