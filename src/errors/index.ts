/**
 * Base error class for all orchestrator errors
 */
export abstract class OrchestratorError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/storage
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Function not found in registry
 */
export class FunctionNotFoundError extends OrchestratorError {
  constructor(functionName: string, availableFunctions?: string[]) {
    const message = `Function "${functionName}" not found in registry`;
    super(message, 'FUNCTION_NOT_FOUND', {
      functionName,
      availableFunctions,
    });
  }
}

/**
 * Function already registered
 */
export class FunctionAlreadyRegisteredError extends OrchestratorError {
  constructor(functionName: string) {
    const message = `Function "${functionName}" is already registered`;
    super(message, 'FUNCTION_ALREADY_REGISTERED', {
      functionName,
    });
  }
}

/**
 * Invalid parameter reference format
 */
export class ParameterResolutionError extends OrchestratorError {
  constructor(reference: string, expectedFormat: string) {
    const message = `Invalid parameter reference format: "${reference}". Expected: ${expectedFormat}`;
    super(message, 'PARAMETER_RESOLUTION_ERROR', {
      reference,
      expectedFormat,
    });
  }
}

/**
 * Step result not found
 */
export class StepResultNotFoundError extends OrchestratorError {
  constructor(stepId: number, availableSteps?: number[]) {
    const message = `Result for step ${stepId} does not exist`;
    super(message, 'STEP_RESULT_NOT_FOUND', {
      stepId,
      availableSteps,
    });
  }
}

/**
 * Function execution error
 */
export class FunctionExecutionError extends OrchestratorError {
  public readonly originalError?: Error;

  constructor(
    functionName: string,
    parameters: Record<string, unknown>,
    originalError: unknown
  ) {
    const errorMessage =
      originalError instanceof Error ? originalError.message : String(originalError);
    const message = `Function "${functionName}" execution failed: ${errorMessage}`;

    super(message, 'FUNCTION_EXECUTION_ERROR', {
      functionName,
      parameters,
      originalErrorMessage: errorMessage,
    });

    if (originalError instanceof Error) {
      this.originalError = originalError;
      // Preserve original stack trace
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

/**
 * Execution timeout error
 */
export class ExecutionTimeoutError extends OrchestratorError {
  constructor(
    stepId: number,
    functionName: string,
    timeoutMs: number
  ) {
    const message = `Step ${stepId} (${functionName}) execution timed out after ${timeoutMs}ms`;
    super(message, 'EXECUTION_TIMEOUT', {
      stepId,
      functionName,
      timeoutMs,
    });
  }
}

/**
 * Type guard to check if an error is an OrchestratorError
 */
export function isOrchestratorError(error: unknown): error is OrchestratorError {
  return error instanceof OrchestratorError;
}

/**
 * Extract user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isOrchestratorError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
