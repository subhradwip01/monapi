import { FrameworkAdapter, BuiltinFramework } from '../../core/types'
import { ExpressAdapter } from './express'
import { HonoAdapter } from './hono'

/**
 * Create a framework adapter by name or return a custom adapter.
 */
export function resolveFrameworkAdapter(
  framework?: BuiltinFramework | FrameworkAdapter,
): FrameworkAdapter {
  if (!framework || framework === 'express') {
    return new ExpressAdapter()
  }

  if (typeof framework === 'string') {
    switch (framework) {
      case 'hono':
        return new HonoAdapter()
      default:
        throw new Error(`Unknown framework: ${framework}. Use 'express', 'hono', or pass a custom FrameworkAdapter.`)
    }
  }

  // Custom adapter object
  return framework
}

export { ExpressAdapter } from './express'
export { HonoAdapter } from './hono'
