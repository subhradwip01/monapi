import { resolveFrameworkAdapter } from '../../src/adapters/framework'
import { ExpressAdapter } from '../../src/adapters/framework/express'
import { HonoAdapter } from '../../src/adapters/framework/hono'
import { FrameworkAdapter } from '../../src/core/types'

describe('resolveFrameworkAdapter', () => {
  it('should return ExpressAdapter by default', () => {
    const adapter = resolveFrameworkAdapter()
    expect(adapter).toBeInstanceOf(ExpressAdapter)
    expect(adapter.name).toBe('express')
  })

  it('should return ExpressAdapter for "express"', () => {
    const adapter = resolveFrameworkAdapter('express')
    expect(adapter).toBeInstanceOf(ExpressAdapter)
  })

  it('should return HonoAdapter for "hono"', () => {
    const adapter = resolveFrameworkAdapter('hono')
    expect(adapter).toBeInstanceOf(HonoAdapter)
    expect(adapter.name).toBe('hono')
  })

  it('should throw for unknown framework string', () => {
    expect(() => resolveFrameworkAdapter('unknown' as any)).toThrow('Unknown framework')
  })

  it('should accept a custom FrameworkAdapter object', () => {
    const custom: FrameworkAdapter = {
      name: 'custom',
      createRouter: () => ({}),
      wrapHandler: (fn) => fn,
      createErrorHandler: () => () => {},
    }
    const adapter = resolveFrameworkAdapter(custom)
    expect(adapter).toBe(custom)
    expect(adapter.name).toBe('custom')
  })
})

describe('ExpressAdapter', () => {
  const adapter = new ExpressAdapter()

  it('should have name "express"', () => {
    expect(adapter.name).toBe('express')
  })

  it('should create a router from empty collections', () => {
    const router = adapter.createRouter(new Map())
    expect(router).toBeDefined()
    expect(typeof router.use).toBe('function')
  })

  it('should wrap a MonapiHandler into Express middleware', () => {
    const handler = jest.fn()
    const wrapped = adapter.wrapHandler(handler)
    expect(typeof wrapped).toBe('function')
  })

  it('should create an error handler function', () => {
    const errorHandler = adapter.createErrorHandler()
    expect(typeof errorHandler).toBe('function')
  })
})

describe('HonoAdapter', () => {
  const adapter = new HonoAdapter()

  it('should have name "hono"', () => {
    expect(adapter.name).toBe('hono')
  })

  it('should wrap a handler', () => {
    const handler = jest.fn()
    const wrapped = adapter.wrapHandler(handler)
    expect(typeof wrapped).toBe('function')
  })

  it('should create an error handler', () => {
    const errorHandler = adapter.createErrorHandler()
    expect(typeof errorHandler).toBe('function')
  })
})
