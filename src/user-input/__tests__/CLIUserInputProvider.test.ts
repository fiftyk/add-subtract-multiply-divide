/**
 * CLIUserInputProvider 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLIUserInputProvider } from '../adapters/CLIUserInputProvider.js';
import type { A2UISchema } from '../interfaces/A2UISchema.js';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';

describe('CLIUserInputProvider', () => {
  let provider: CLIUserInputProvider;

  beforeEach(() => {
    provider = new CLIUserInputProvider();
    vi.clearAllMocks();
  });

  describe('supportsFieldType', () => {
    it('should support all basic field types', () => {
      expect(provider.supportsFieldType('text')).toBe(true);
      expect(provider.supportsFieldType('number')).toBe(true);
      expect(provider.supportsFieldType('boolean')).toBe(true);
      expect(provider.supportsFieldType('date')).toBe(true);
      expect(provider.supportsFieldType('single_select')).toBe(true);
      expect(provider.supportsFieldType('multi_select')).toBe(true);
    });

    it('should not support unsupported field types', () => {
      expect(provider.supportsFieldType('file')).toBe(false);
      expect(provider.supportsFieldType('unknown')).toBe(false);
    });
  });

  describe('requestInput', () => {
    it('should collect valid JSON input', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'companyName',
            type: 'text',
            label: '公司名称',
            required: true,
          },
          {
            id: 'year',
            type: 'number',
            label: '年份',
            required: false,
          },
        ],
      };

      const mockInput = {
        companyName: '华为',
        year: 2023,
      };

      // Mock inquirer.prompt to return JSON input
      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      const result = await provider.requestInput(schema);

      expect(result.values).toEqual(mockInput);
      expect(result.timestamp).toBeTypeOf('number');
      expect(result.skipped).toBe(false);
    });

    it('should validate required fields', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'companyName',
            type: 'text',
            label: '公司名称',
            required: true,
          },
        ],
      };

      // Missing required field
      const mockInput = {};

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate field types', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'age',
            type: 'number',
            label: 'Age',
            required: true,
          },
        ],
      };

      // Wrong type: string instead of number
      const mockInput = {
        age: 'not a number',
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate number range', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'age',
            type: 'number',
            label: 'Age',
            required: true,
            validation: {
              range: { min: 0, max: 120 },
            },
          },
        ],
      };

      // Out of range
      const mockInput = {
        age: 150,
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate text length', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
            validation: {
              length: { min: 2, max: 10 },
            },
          },
        ],
      };

      // Too short
      const mockInput = {
        name: 'a',
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate text pattern', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'email',
            type: 'text',
            label: 'Email',
            required: true,
            validation: {
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            },
          },
        ],
      };

      // Invalid email
      const mockInput = {
        email: 'invalid-email',
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate single_select options', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'country',
            type: 'single_select',
            label: 'Country',
            required: true,
            config: {
              options: [
                { value: 'cn', label: '中国' },
                { value: 'us', label: '美国' },
              ],
            },
          },
        ],
      };

      // Invalid option
      const mockInput = {
        country: 'invalid',
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should validate multi_select min/max selections', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'skills',
            type: 'multi_select',
            label: 'Skills',
            required: true,
            config: {
              options: [
                { value: 'js', label: 'JavaScript' },
                { value: 'ts', label: 'TypeScript' },
                { value: 'py', label: 'Python' },
              ],
              minSelections: 1,
              maxSelections: 2,
            },
          },
        ],
      };

      // Empty array (below min)
      const mockInput1 = {
        skills: [],
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput1),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );

      // Too many selections (above max)
      const mockInput2 = {
        skills: ['js', 'ts', 'py'],
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput2),
      });

      await expect(provider.requestInput(schema)).rejects.toThrow(
        /Validation failed/
      );
    });

    it('should handle optional fields with undefined values', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
          },
          {
            id: 'description',
            type: 'text',
            label: 'Description',
            required: false,
          },
        ],
      };

      const mockInput = {
        name: 'Test',
        // description is omitted
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      const result = await provider.requestInput(schema);

      expect(result.values.name).toBe('Test');
      expect(result.values.description).toBeUndefined();
    });

    it('should use default values in example generation', async () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'port',
            type: 'number',
            label: 'Port',
            defaultValue: 3000,
          },
        ],
      };

      const mockInput = {
        port: 3000,
      };

      (inquirer.prompt as any).mockResolvedValueOnce({
        jsonInput: JSON.stringify(mockInput),
      });

      const result = await provider.requestInput(schema);

      expect(result.values.port).toBe(3000);
    });
  });
});
