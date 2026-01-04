/**
 * Error handling middleware
 *
 * Central error handler for consistent error responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '../errors/ApiErrors.js';
import { LoggerFactory } from '../../logger/index.js';

const logger = LoggerFactory.create();

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('API error', err, { path: req.path, method: req.method });

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.issues,
    });
    return;
  }

  // Custom validation errors
  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Not found errors
  if (err instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Unauthorized errors
  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Forbidden errors
  if (err instanceof ForbiddenError) {
    res.status(403).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

/**
 * Async handler wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
