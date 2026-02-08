import { createHookContext, executeHook } from '../../src/engine/hook-executor'
import { LifecycleHooks, HookContext } from '../../src/types'

// Minimal mock of Express Request/Response
function mockReq(overrides: Record<string, any> = {}): any {
  return { params: {}, query: {}, body: {}, ...overrides }
}

function mockRes(): any {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() }
}

describe('createHookContext', () => {
  it('should create context with all properties', () => {
    const req = mockReq({ user: { id: 'u1', roles: ['admin'] } })
    const res = mockRes()

    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req,
      res,
      data: { name: 'John' },
      id: '123',
    })

    expect(ctx.collection).toBe('users')
    expect(ctx.operation).toBe('create')
    expect(ctx.user).toEqual({ id: 'u1', roles: ['admin'] })
    expect(ctx.data).toEqual({ name: 'John' })
    expect(ctx.id).toBe('123')
    expect(ctx.req).toBe(req)
    expect(ctx.res).toBe(res)
    expect(ctx.meta).toEqual({})
  })

  it('should set user to undefined if not on request', () => {
    const ctx = createHookContext({
      collection: 'posts',
      operation: 'find',
      req: mockReq(),
      res: mockRes(),
    })
    expect(ctx.user).toBeUndefined()
  })
})

describe('executeHook', () => {
  it('should execute hook function', async () => {
    const hookFn = jest.fn()
    const hooks: Partial<LifecycleHooks> = { beforeCreate: hookFn }

    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
    })

    await executeHook(hooks, 'beforeCreate', ctx)
    expect(hookFn).toHaveBeenCalledWith(ctx)
  })

  it('should return context unchanged if no hooks', async () => {
    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
    })

    const result = await executeHook(undefined, 'beforeCreate', ctx)
    expect(result).toBe(ctx)
  })

  it('should return context unchanged if specific hook not defined', async () => {
    const hooks: Partial<LifecycleHooks> = {}
    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
    })

    const result = await executeHook(hooks, 'beforeCreate', ctx)
    expect(result).toBe(ctx)
  })

  it('should allow hooks to modify context', async () => {
    const hooks: Partial<LifecycleHooks> = {
      beforeCreate: (ctx: HookContext) => {
        ctx.data = { ...ctx.data, injected: true }
      },
    }

    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
      data: { name: 'John' },
    })

    await executeHook(hooks, 'beforeCreate', ctx)
    expect(ctx.data).toEqual({ name: 'John', injected: true })
  })

  it('should support async hooks', async () => {
    const hooks: Partial<LifecycleHooks> = {
      afterCreate: async (ctx: HookContext) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        ctx.meta = { processed: true }
      },
    }

    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
    })

    await executeHook(hooks, 'afterCreate', ctx)
    expect(ctx.meta).toEqual({ processed: true })
  })

  it('should propagate hook errors', async () => {
    const hooks: Partial<LifecycleHooks> = {
      beforeDelete: () => {
        throw new Error('Cannot delete')
      },
    }

    const ctx = createHookContext({
      collection: 'users',
      operation: 'delete',
      req: mockReq(),
      res: mockRes(),
    })

    await expect(executeHook(hooks, 'beforeDelete', ctx)).rejects.toThrow('Cannot delete')
  })

  it('should log errors if logger provided', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
    const hooks: Partial<LifecycleHooks> = {
      beforeCreate: () => {
        throw new Error('Hook failed')
      },
    }

    const ctx = createHookContext({
      collection: 'users',
      operation: 'create',
      req: mockReq(),
      res: mockRes(),
    })

    await expect(executeHook(hooks, 'beforeCreate', ctx, logger)).rejects.toThrow('Hook failed')
    expect(logger.error).toHaveBeenCalled()
  })
})
