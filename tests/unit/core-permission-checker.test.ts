import { checkPermissions } from '../../src/core/permission-checker'
import { UnauthorizedError, ForbiddenError } from '../../src/utils/errors'
import { MonapiRequest } from '../../src/core/types'

function mockReq(user?: any): MonapiRequest {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    method: 'GET',
    path: '/',
    user,
    raw: {},
  }
}

describe('checkPermissions (core)', () => {
  it('should do nothing when no permissions configured', async () => {
    await expect(checkPermissions(mockReq(), 'users', 'list')).resolves.toBeUndefined()
  })

  it('should do nothing when no permission for this operation', async () => {
    await expect(
      checkPermissions(mockReq(), 'users', 'list', { create: ['admin'] }),
    ).resolves.toBeUndefined()
  })

  it('should throw UnauthorizedError when permission set but no user', async () => {
    await expect(
      checkPermissions(mockReq(), 'users', 'create', { create: ['admin'] }),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('should throw ForbiddenError when user lacks role', async () => {
    await expect(
      checkPermissions(mockReq({ id: 'u1', roles: ['user'] }), 'users', 'create', {
        create: ['admin'],
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('should allow when user has required role', async () => {
    await expect(
      checkPermissions(mockReq({ id: 'u1', roles: ['admin'] }), 'users', 'create', {
        create: ['admin'],
      }),
    ).resolves.toBeUndefined()
  })

  it('should support custom permission functions', async () => {
    const customFn = jest.fn().mockResolvedValue(true)
    await expect(
      checkPermissions(mockReq({ id: 'u1', roles: [] }), 'users', 'delete', {
        delete: customFn,
      }),
    ).resolves.toBeUndefined()
    expect(customFn).toHaveBeenCalled()
  })

  it('should throw ForbiddenError when custom fn returns false', async () => {
    const customFn = jest.fn().mockResolvedValue(false)
    await expect(
      checkPermissions(mockReq({ id: 'u1', roles: [] }), 'users', 'delete', {
        delete: customFn,
      }),
    ).rejects.toThrow(ForbiddenError)
  })
})
