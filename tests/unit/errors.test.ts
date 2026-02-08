import {
  MonapiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  BadRequestError,
} from '../../src/utils/errors'

describe('Error classes', () => {
  describe('MonapiError', () => {
    it('should create error with all properties', () => {
      const err = new MonapiError('Test error', 500, 'TEST_ERROR', { key: 'val' })
      expect(err.message).toBe('Test error')
      expect(err.statusCode).toBe(500)
      expect(err.code).toBe('TEST_ERROR')
      expect(err.details).toEqual({ key: 'val' })
      expect(err.name).toBe('MonapiError')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(MonapiError)
    })
  })

  describe('NotFoundError', () => {
    it('should create 404 error with resource name', () => {
      const err = new NotFoundError('users')
      expect(err.statusCode).toBe(404)
      expect(err.code).toBe('NOT_FOUND')
      expect(err.message).toBe('users not found')
    })

    it('should include id in message if provided', () => {
      const err = new NotFoundError('users', '123')
      expect(err.message).toBe("users with id '123' not found")
    })

    it('should be instanceof MonapiError', () => {
      const err = new NotFoundError('users')
      expect(err).toBeInstanceOf(MonapiError)
    })
  })

  describe('ValidationError', () => {
    it('should create 400 error', () => {
      const details = [{ field: 'name', message: 'required' }]
      const err = new ValidationError('Validation failed', details)
      expect(err.statusCode).toBe(400)
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.details).toEqual(details)
    })
  })

  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const err = new ForbiddenError()
      expect(err.statusCode).toBe(403)
      expect(err.code).toBe('FORBIDDEN')
      expect(err.message).toBe('Access denied')
    })

    it('should accept custom message', () => {
      const err = new ForbiddenError('Custom forbidden')
      expect(err.message).toBe('Custom forbidden')
    })
  })

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const err = new UnauthorizedError()
      expect(err.statusCode).toBe(401)
      expect(err.code).toBe('UNAUTHORIZED')
      expect(err.message).toBe('Authentication required')
    })
  })

  describe('BadRequestError', () => {
    it('should create 400 error', () => {
      const err = new BadRequestError('Invalid input', { field: 'age' })
      expect(err.statusCode).toBe(400)
      expect(err.code).toBe('BAD_REQUEST')
      expect(err.details).toEqual({ field: 'age' })
    })
  })
})
