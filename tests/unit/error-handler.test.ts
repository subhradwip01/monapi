import { createErrorHandler } from '../../src/middleware/error-handler'
import { NotFoundError, ValidationError } from '../../src/utils/errors'

function mockReq(): any {
  return {}
}

function mockRes(): any {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

const mockNext = jest.fn()

describe('createErrorHandler', () => {
  const handler = createErrorHandler()

  beforeEach(() => {
    mockNext.mockClear()
  })

  it('should handle MonapiError with correct status code', () => {
    const res = mockRes()
    const err = new NotFoundError('users', '123')

    handler(err, mockReq(), res, mockNext)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: "users with id '123' not found",
        details: undefined,
      },
    })
  })

  it('should handle ValidationError with details', () => {
    const res = mockRes()
    const details = [{ field: 'name', message: 'required' }]
    const err = new ValidationError('Validation failed', details)

    handler(err, mockReq(), res, mockNext)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    })
  })

  it('should handle generic errors with 500 status', () => {
    const res = mockRes()
    const err = new Error('Something broke')

    handler(err, mockReq(), res, mockNext)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something broke',
      },
    })
  })

  it('should hide error details in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const res = mockRes()
    const prodHandler = createErrorHandler()
    const err = new Error('Sensitive details')

    prodHandler(err, mockReq(), res, mockNext)

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    })

    process.env.NODE_ENV = originalEnv
  })

  it('should log errors when logger is provided', () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
    const logHandler = createErrorHandler(logger)
    const res = mockRes()

    const err = new NotFoundError('users')
    logHandler(err, mockReq(), res, mockNext)
    expect(logger.warn).toHaveBeenCalled()

    const genericErr = new Error('bad')
    logHandler(genericErr, mockReq(), res, mockNext)
    expect(logger.error).toHaveBeenCalled()
  })
})
