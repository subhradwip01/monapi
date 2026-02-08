import { createPermissionMiddleware, createAuthMiddleware } from '../../src/middleware/auth'
import { UnauthorizedError, ForbiddenError } from '../../src/utils/errors'

function mockReq(user?: any): any {
  return { user, params: {}, body: {} }
}

function mockRes(): any {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() }
}

describe('createPermissionMiddleware', () => {
  it('should call next() when no permissions configured', async () => {
    const middleware = createPermissionMiddleware('users', 'list')
    const next = jest.fn()

    await middleware(mockReq(), mockRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('should call next() when no permission for this operation', async () => {
    const middleware = createPermissionMiddleware('users', 'list', { create: ['admin'] })
    const next = jest.fn()

    await middleware(mockReq(), mockRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('should pass UnauthorizedError when permission set but no user', async () => {
    const middleware = createPermissionMiddleware('users', 'create', { create: ['admin'] })
    const next = jest.fn()

    await middleware(mockReq(), mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))
  })

  it('should pass ForbiddenError when user lacks required role', async () => {
    const middleware = createPermissionMiddleware('users', 'create', { create: ['admin'] })
    const next = jest.fn()
    const req = mockReq({ id: 'u1', roles: ['user'] })

    await middleware(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))
  })

  it('should call next() when user has required role', async () => {
    const middleware = createPermissionMiddleware('users', 'create', { create: ['admin'] })
    const next = jest.fn()
    const req = mockReq({ id: 'u1', roles: ['admin'] })

    await middleware(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('should support multiple allowed roles', async () => {
    const middleware = createPermissionMiddleware('users', 'update', {
      update: ['admin', 'moderator'],
    })
    const next = jest.fn()
    const req = mockReq({ id: 'u1', roles: ['moderator'] })

    await middleware(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('should support custom permission functions', async () => {
    const customFn = jest.fn().mockResolvedValue(true)
    const middleware = createPermissionMiddleware('users', 'delete', { delete: customFn })
    const next = jest.fn()
    const req = mockReq({ id: 'u1', roles: ['user'] })

    await middleware(req, mockRes(), next)
    expect(customFn).toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('should deny when custom permission function returns false', async () => {
    const customFn = jest.fn().mockResolvedValue(false)
    const middleware = createPermissionMiddleware('users', 'delete', { delete: customFn })
    const next = jest.fn()
    const req = mockReq({ id: 'u1', roles: ['user'] })

    await middleware(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))
  })

  it('should pass ForbiddenError when user has no roles array', async () => {
    const middleware = createPermissionMiddleware('users', 'create', { create: ['admin'] })
    const next = jest.fn()
    const req = mockReq({ id: 'u1' }) // no roles

    await middleware(req, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))
  })
})

describe('createAuthMiddleware', () => {
  it('should return custom middleware if provided', () => {
    const customAuth = jest.fn()
    const middleware = createAuthMiddleware({ middleware: customAuth })
    expect(middleware).toBe(customAuth)
  })

  it('should return no-op middleware if no auth config', () => {
    const middleware = createAuthMiddleware()
    const next = jest.fn()
    middleware(mockReq() as any, mockRes() as any, next)
    expect(next).toHaveBeenCalled()
  })

  it('should return no-op middleware if auth config has no middleware', () => {
    const middleware = createAuthMiddleware({})
    const next = jest.fn()
    middleware(mockReq() as any, mockRes() as any, next)
    expect(next).toHaveBeenCalled()
  })
})
