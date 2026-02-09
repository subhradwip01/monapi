import { Model, Schema } from 'mongoose'
import {
  SchemaAdapter,
  ValidationResult,
  FieldMetadata,
  FieldType,
} from '../../types'
import { MongooseAdapter } from './MongooseAdapter'

/**
 * Options for TypegooseAdapter
 */
export interface TypegooseAdapterOptions {
  existingConnection?: any
}

/**
 * Schema adapter for Typegoose classes.
 * Converts a Typegoose class to a Mongoose Model via getModelForClass()
 * and delegates all operations to MongooseAdapter.
 */
export class TypegooseAdapter implements SchemaAdapter {
  private inner: MongooseAdapter
  private typegooseClass: any

  constructor(typegooseClass: any, options?: TypegooseAdapterOptions) {
    this.typegooseClass = typegooseClass

    let model: Model<any>
    try {
      // Dynamic import of @typegoose/typegoose
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const typegoose = require('@typegoose/typegoose')

      if (options?.existingConnection) {
        model = typegoose.getModelForClass(typegooseClass, {
          existingConnection: options.existingConnection,
        })
      } else {
        model = typegoose.getModelForClass(typegooseClass)
      }
    } catch (err: any) {
      throw new Error(
        `Failed to create model from Typegoose class. Make sure @typegoose/typegoose is installed. ${err.message}`
      )
    }

    this.inner = new MongooseAdapter(model)
  }

  getFields(): string[] {
    return this.inner.getFields()
  }

  getFieldType(field: string): FieldType {
    return this.inner.getFieldType(field)
  }

  getFieldMetadata(field: string): FieldMetadata | undefined {
    return this.inner.getFieldMetadata(field)
  }

  getAllFieldsMetadata(): FieldMetadata[] {
    return this.inner.getAllFieldsMetadata()
  }

  validate(data: unknown): Promise<ValidationResult> | ValidationResult {
    return this.inner.validate(data)
  }

  getMongooseModel(): Model<any> | undefined {
    return this.inner.getMongooseModel()
  }

  getMongooseSchema(): Schema | undefined {
    return this.inner.getMongooseSchema()
  }

  /**
   * Get the original Typegoose class
   */
  getTypegooseClass(): any {
    return this.typegooseClass
  }
}
