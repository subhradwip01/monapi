import { Logger } from '../types'

/**
 * Default console logger for Monapi
 */
export const defaultLogger: Logger = {
  info(message: string, meta?: any) {
    console.log(`[monapi] INFO: ${message}`, meta ? meta : '')
  },
  warn(message: string, meta?: any) {
    console.warn(`[monapi] WARN: ${message}`, meta ? meta : '')
  },
  error(message: string, meta?: any) {
    console.error(`[monapi] ERROR: ${message}`, meta ? meta : '')
  },
  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[monapi] DEBUG: ${message}`, meta ? meta : '')
    }
  },
}
