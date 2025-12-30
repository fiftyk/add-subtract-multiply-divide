import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DynamicFunctionCodeValidatorImpl } from '../implementations/DynamicFunctionCodeValidator.js';
import type { FunctionDefinition } from '../../registry/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DynamicFunctionCodeValidator', () => {
  let validator: DynamicFunctionCodeValidator;
  const testDir = path.join(__dirname, '../../../.test-temp');

  beforeEach(async () => {
    validator = new DynamicFunctionCodeValidatorImpl();
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
      await fs.rmdir(testDir);
    } catch {
      // Ignore errors
    }
  });

  describe('validateCode', () => {
    it('should validate correct JavaScript code', async () => {
      const validCode = `
export const testFunc = {
  name: 'testFunc',
  implementation: () => 42
};
`;
      const filePath = path.join(testDir, 'valid.js');
      await fs.writeFile(filePath, validCode);

      const result = await validator.validateCode(filePath);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail for invalid syntax', async () => {
      const invalidCode = `
export const testFunc = {
  name: 'testFunc',
  implementation: () => {
    // Missing closing brace
`;
      const filePath = path.join(testDir, 'invalid.js');
      await fs.writeFile(filePath, invalidCode);

      const result = await validator.validateCode(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to import generated code');
      expect(result.details).toBeTruthy();
    });

    it('should fail for non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.js');

      const result = await validator.validateCode(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to import generated code');
    });
  });

  describe('testFunction', () => {
    it('should test function with simple parameters', async () => {
      const fn: FunctionDefinition = {
        name: 'add',
        description: 'Add two numbers',
        scenario: 'Math operations',
        parameters: [
          { name: 'a', type: 'number', description: 'First number' },
          { name: 'b', type: 'number', description: 'Second number' },
        ],
        returns: { type: 'number', description: 'Sum' },
        implementation: (a: number, b: number) => a + b,
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should test function with string parameters', async () => {
      const fn: FunctionDefinition = {
        name: 'greet',
        description: 'Greet a person',
        scenario: 'String operations',
        parameters: [
          { name: 'name', type: 'string', description: 'Name to greet' },
        ],
        returns: { type: 'string', description: 'Greeting' },
        implementation: (name: string) => `Hello, ${name}!`,
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle async functions', async () => {
      const fn: FunctionDefinition = {
        name: 'asyncFunc',
        description: 'Async function',
        scenario: 'Async operations',
        parameters: [
          { name: 'value', type: 'number', description: 'Input value' },
        ],
        returns: { type: 'number', description: 'Result' },
        implementation: async (value: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return value * 2;
        },
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should catch errors in function execution', async () => {
      const fn: FunctionDefinition = {
        name: 'errorFunc',
        description: 'Function that throws error',
        scenario: 'Error handling',
        parameters: [],
        returns: { type: 'void', description: 'Nothing' },
        implementation: () => {
          throw new Error('Test error');
        },
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should handle functions with array parameters', async () => {
      const fn: FunctionDefinition = {
        name: 'sumArray',
        description: 'Sum array elements',
        scenario: 'Array operations',
        parameters: [
          { name: 'arr', type: 'array', description: 'Array of numbers' },
        ],
        returns: { type: 'number', description: 'Sum' },
        implementation: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(true);
    });

    it('should handle functions with object parameters', async () => {
      const fn: FunctionDefinition = {
        name: 'processObject',
        description: 'Process object',
        scenario: 'Object operations',
        parameters: [
          { name: 'obj', type: 'object', description: 'Input object' },
        ],
        returns: { type: 'string', description: 'Result' },
        implementation: (obj: Record<string, unknown>) =>
          JSON.stringify(obj),
      };

      const result = await validator.testFunction(fn);

      expect(result.success).toBe(true);
    });
  });
});
