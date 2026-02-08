import { Request, Response, NextFunction } from 'express'
import { MonapiError } from '../utils/errors'
import { Logger, ErrorResponse } from '../types'

/**
 * Create Express error handling middleware
 */
export function createErrorHandler(logger?: Logger) {
  return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof MonapiError) {
      if (logger) {
        logger.warn(`${err.code}: ${err.message}`, { statusCode: err.statusCode })
      }

      const response: ErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      }
      res.status(err.statusCode).json(response)
      return
    }

    // Unknown errors - don't leak internals in production
    if (logger) {
      logger.error(`Unhandled error: ${err.message}`, { stack: err.stack })
    }

    const message =
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message

    const response: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    }
    res.status(500).json(response)
  }
}
