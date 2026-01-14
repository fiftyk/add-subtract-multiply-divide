import type { FunctionCompletionSpec } from '../types.js';

/**
 * Interface for generating function code
 * Responsibility: Generate TypeScript code for a function
 */
export interface FunctionCodeGenerator {
  /**
   * Generate function code from specification
   * @param spec - Function specification
   * @returns Generated TypeScript code as string
   */
  generate(spec: FunctionCompletionSpec): Promise<string>;
}

export const FunctionCodeGenerator = Symbol('FunctionCodeGenerator');
