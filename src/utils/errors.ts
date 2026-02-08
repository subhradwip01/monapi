/**
 * Base error class for Monapi
 */
export class MonapiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: any

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message)
    this.name = 'MonapiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, MonapiError.prototype)
  }
}

export class NotFoundError extends MonapiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class ValidationError extends MonapiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class ForbiddenError extends MonapiError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

export class UnauthorizedError extends MonapiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

export class BadRequestError extends MonapiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BAD_REQUEST', details)
    this.name = 'BadRequestError'
    Object.setPrototypeOf(this, BadRequestError.prototype)
  }
}
