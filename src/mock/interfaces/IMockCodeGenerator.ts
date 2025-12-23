import type { MockFunctionSpec } from '../types.js';

/**
 * Interface for generating mock function code
 * Responsibility: Generate TypeScript code for a mock function
 */
export interface IMockCodeGenerator {
  /**
   * Generate mock function code from specification
   * @param spec - Function specification
   * @returns Generated TypeScript code as string
   */
  generate(spec: MockFunctionSpec): Promise<string>;
}
