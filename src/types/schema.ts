import { Model, Schema } from 'mongoose'
import { FieldType } from './query'

/**
 * Validation result from schema validation
 */
export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
  data?: any
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string
  message: string
  code?: string
}

/**
 * Field metadata from schema
 */
export interface FieldMetadata {
  name: string
  type: FieldType
  required?: boolean
  default?: any
  enum?: any[]
}

/**
 * Base interface for schema adapters
 * All schema types (Mongoose, Zod, Joi, etc.) must implement this
 */
export interface SchemaAdapter {
  /**
   * Get list of all field names in the schema
   */
  getFields(): string[]

  /**
   * Get the type of a specific field
   */
  getFieldType(field: string): FieldType

  /**
   * Get metadata for a specific field
   */
  getFieldMetadata(field: string): FieldMetadata | undefined

  /**
   * Get all fields metadata
   */
  getAllFieldsMetadata(): FieldMetadata[]

  /**
   * Validate data against the schema
   */
  validate(data: unknown): Promise<ValidationResult> | ValidationResult

  /**
   * Get the underlying Mongoose model if available
   */
  getMongooseModel?(): Model<any> | undefined

  /**
   * Get the underlying Mongoose schema if available
   */
  getMongooseSchema?(): Schema | undefined
}

/**
 * Schema type detection
 */
export enum SchemaType {
  Mongoose = 'mongoose',
  Typegoose = 'typegoose',
  Zod = 'zod',
  Joi = 'joi',
  Yup = 'yup',
  Unknown = 'unknown',
}

/**
 * Schema configuration options
 */
export interface SchemaOptions {
  strict?: boolean
  timestamps?: boolean
  validateBeforeSave?: boolean
}
