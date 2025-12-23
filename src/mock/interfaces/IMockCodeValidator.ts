import type { FunctionDefinition } from '../../registry/index.js';

/**
 * Interface for validating generated mock code
 * Follows SRP: Only responsible for code validation
 * Follows ISP: Small, focused interface
 */
export interface IMockCodeValidator {
  /**
   * Validate that code can be executed without errors
   * @param filePath - Path to the generated code file
   * @returns Validation result with any errors
   */
  validateCode(filePath: string): Promise<ValidationResult>;

  /**
   * Test that the loaded function can be called
   * @param fn - Function definition to test
   * @returns Test result with any errors
   */
  testFunction(fn: FunctionDefinition): Promise<TestResult>;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface TestResult {
  success: boolean;
  error?: string;
  executionTime?: number;
}
