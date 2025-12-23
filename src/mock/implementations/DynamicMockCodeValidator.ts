import { pathToFileURL } from 'url';
import type {
  IMockCodeValidator,
  ValidationResult,
  TestResult,
} from '../interfaces/IMockCodeValidator.js';
import type { FunctionDefinition } from '../../registry/index.js';

/**
 * Validates generated mock code by attempting to load and execute it
 * Follows SRP: Only responsible for validation logic
 */
export class DynamicMockCodeValidator implements IMockCodeValidator {
  /**
   * Validate that generated code can be imported without errors
   */
  async validateCode(filePath: string): Promise<ValidationResult> {
    try {
      // Attempt to dynamically import the file
      const fileUrl = pathToFileURL(filePath).href;
      const moduleUrl = `${fileUrl}?t=${Date.now()}`; // Cache busting
      await import(moduleUrl);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to import generated code',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test that the function can be called with mock parameters
   */
  async testFunction(fn: FunctionDefinition): Promise<TestResult> {
    try {
      const startTime = Date.now();

      // Generate mock parameters based on types
      const mockParams = fn.parameters.map((param) =>
        this.generateMockValue(param.type)
      );

      // Try to call the function
      const result = fn.implementation(...mockParams);

      // If it returns a promise, await it
      if (result instanceof Promise) {
        await result;
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a mock value for testing based on type
   */
  private generateMockValue(type: string): unknown {
    switch (type) {
      case 'string':
        return 'test_string';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        return [1, 2, 3];
      case 'object':
        return { test: 'value' };
      default:
        return null;
    }
  }
}
