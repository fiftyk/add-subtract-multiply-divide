import { OrchestratorError } from '../errors/index.js';

/**
 * Validation error
 */
export class ValidationError extends OrchestratorError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Parameter validation error
 */
export class ParameterValidationError extends ValidationError {
  constructor(
    parameterName: string,
    expectedType: string,
    actualValue: unknown
  ) {
    const message = `Parameter "${parameterName}" validation failed: expected ${expectedType}, got ${typeof actualValue}`;
    super(message, {
      parameterName,
      expectedType,
      actualType: typeof actualValue,
      actualValue,
    });
  }
}

/**
 * Plan validation error
 */
export class PlanValidationError extends ValidationError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Plan validation failed: ${reason}`, details);
  }
}
