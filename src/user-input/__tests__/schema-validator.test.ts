/**
 * Schema 验证器测试
 */

import { describe, it, expect } from 'vitest';
import { validateA2UISchema, validateUserInput } from '../validation/schema-validator.js';
import type { A2UISchema, A2UIField } from '../interfaces/A2UISchema.js';

describe('Schema Validator', () => {
  describe('validateA2UISchema', () => {
    it('should validate a valid schema', () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
          },
        ],
      };

      expect(() => validateA2UISchema(schema)).not.toThrow();
    });

    it('should reject schema without version', () => {
      const invalidSchema = {
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
          },
        ],
      };

      expect(() => validateA2UISchema(invalidSchema)).toThrow();
    });

    it('should reject schema with wrong version', () => {
      const invalidSchema = {
        version: '2.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
          },
        ],
      };

      expect(() => validateA2UISchema(invalidSchema)).toThrow();
    });

    it('should reject schema without fields', () => {
      const invalidSchema = {
        version: '1.0',
        fields: [],
      };

      expect(() => validateA2UISchema(invalidSchema)).toThrow();
    });

    it('should reject schema with invalid field type', () => {
      const invalidSchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'invalid_type',
            label: 'Name',
          },
        ],
      };

      expect(() => validateA2UISchema(invalidSchema)).toThrow();
    });

    it('should accept schema with optional config', () => {
      const schema: A2UISchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
          },
        ],
        config: {
          timeout: 60000,
          skippable: true,
        },
      };

      expect(() => validateA2UISchema(schema)).not.toThrow();
    });

    it('should reject negative timeout', () => {
      const invalidSchema = {
        version: '1.0',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
          },
        ],
        config: {
          timeout: -1000,
        },
      };

      expect(() => validateA2UISchema(invalidSchema)).toThrow();
    });
  });

  describe('validateUserInput - text field', () => {
    it('should validate valid text input', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        required: true,
      };

      const result = validateUserInput(field, 'John Doe');
      expect(result.valid).toBe(true);
    });

    it('should reject empty required text', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        required: true,
      };

      const result = validateUserInput(field, '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should accept empty optional text', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        required: false,
      };

      const result = validateUserInput(field, '');
      expect(result.valid).toBe(true);
    });

    it('should validate text length constraint', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        validation: {
          length: { min: 2, max: 10 },
        },
      };

      expect(validateUserInput(field, 'ab').valid).toBe(true);
      expect(validateUserInput(field, 'a').valid).toBe(false);
      expect(validateUserInput(field, 'a'.repeat(11)).valid).toBe(false);
    });

    it('should validate text pattern', () => {
      const field: A2UIField = {
        id: 'email',
        type: 'text',
        label: 'Email',
        validation: {
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      };

      expect(validateUserInput(field, 'test@example.com').valid).toBe(true);
      expect(validateUserInput(field, 'invalid-email').valid).toBe(false);
    });

    it('should use custom error message', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        validation: {
          length: { min: 5 },
          errorMessage: 'Name must be at least 5 characters',
        },
      };

      const result = validateUserInput(field, 'abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 5 characters');
    });

    it('should reject non-string value for text field', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
      };

      const result = validateUserInput(field, 123);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('validateUserInput - number field', () => {
    it('should validate valid number input', () => {
      const field: A2UIField = {
        id: 'age',
        type: 'number',
        label: 'Age',
      };

      expect(validateUserInput(field, 25).valid).toBe(true);
      expect(validateUserInput(field, 0).valid).toBe(true);
      expect(validateUserInput(field, -10).valid).toBe(true);
    });

    it('should reject non-number value', () => {
      const field: A2UIField = {
        id: 'age',
        type: 'number',
        label: 'Age',
      };

      expect(validateUserInput(field, 'not a number').valid).toBe(false);
      expect(validateUserInput(field, NaN).valid).toBe(false);
    });

    it('should validate number range', () => {
      const field: A2UIField = {
        id: 'age',
        type: 'number',
        label: 'Age',
        validation: {
          range: { min: 0, max: 120 },
        },
      };

      expect(validateUserInput(field, 50).valid).toBe(true);
      expect(validateUserInput(field, 0).valid).toBe(true);
      expect(validateUserInput(field, 120).valid).toBe(true);
      expect(validateUserInput(field, -1).valid).toBe(false);
      expect(validateUserInput(field, 121).valid).toBe(false);
    });

    it('should validate only min range', () => {
      const field: A2UIField = {
        id: 'price',
        type: 'number',
        label: 'Price',
        validation: {
          range: { min: 0 },
        },
      };

      expect(validateUserInput(field, 0).valid).toBe(true);
      expect(validateUserInput(field, 100).valid).toBe(true);
      expect(validateUserInput(field, -1).valid).toBe(false);
    });

    it('should validate only max range', () => {
      const field: A2UIField = {
        id: 'discount',
        type: 'number',
        label: 'Discount',
        validation: {
          range: { max: 100 },
        },
      };

      expect(validateUserInput(field, 100).valid).toBe(true);
      expect(validateUserInput(field, -100).valid).toBe(true);
      expect(validateUserInput(field, 101).valid).toBe(false);
    });
  });

  describe('validateUserInput - boolean field', () => {
    it('should validate valid boolean input', () => {
      const field: A2UIField = {
        id: 'agreed',
        type: 'boolean',
        label: 'I agree',
      };

      expect(validateUserInput(field, true).valid).toBe(true);
      expect(validateUserInput(field, false).valid).toBe(true);
    });

    it('should reject non-boolean value', () => {
      const field: A2UIField = {
        id: 'agreed',
        type: 'boolean',
        label: 'I agree',
      };

      expect(validateUserInput(field, 'yes').valid).toBe(false);
      expect(validateUserInput(field, 1).valid).toBe(false);
    });
  });

  describe('validateUserInput - single_select field', () => {
    it('should validate valid selection', () => {
      const field: A2UIField = {
        id: 'country',
        type: 'single_select',
        label: 'Country',
        config: {
          options: [
            { value: 'cn', label: '中国' },
            { value: 'us', label: '美国' },
          ],
        },
      };

      expect(validateUserInput(field, 'cn').valid).toBe(true);
      expect(validateUserInput(field, 'us').valid).toBe(true);
    });

    it('should reject invalid selection', () => {
      const field: A2UIField = {
        id: 'country',
        type: 'single_select',
        label: 'Country',
        config: {
          options: [
            { value: 'cn', label: '中国' },
            { value: 'us', label: '美国' },
          ],
        },
      };

      const result = validateUserInput(field, 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid selection');
    });

    it('should work with numeric values', () => {
      const field: A2UIField = {
        id: 'rating',
        type: 'single_select',
        label: 'Rating',
        config: {
          options: [
            { value: 1, label: '1 star' },
            { value: 5, label: '5 stars' },
          ],
        },
      };

      expect(validateUserInput(field, 1).valid).toBe(true);
      expect(validateUserInput(field, 5).valid).toBe(true);
      expect(validateUserInput(field, 3).valid).toBe(false);
    });
  });

  describe('validateUserInput - multi_select field', () => {
    it('should validate valid multi-selection', () => {
      const field: A2UIField = {
        id: 'languages',
        type: 'multi_select',
        label: 'Languages',
        config: {
          options: [
            { value: 'js', label: 'JavaScript' },
            { value: 'ts', label: 'TypeScript' },
            { value: 'py', label: 'Python' },
          ],
        },
      };

      expect(validateUserInput(field, ['js']).valid).toBe(true);
      expect(validateUserInput(field, ['js', 'ts']).valid).toBe(true);
      expect(validateUserInput(field, []).valid).toBe(true);
    });

    it('should reject non-array value', () => {
      const field: A2UIField = {
        id: 'languages',
        type: 'multi_select',
        label: 'Languages',
        config: {
          options: [
            { value: 'js', label: 'JavaScript' },
          ],
        },
      };

      const result = validateUserInput(field, 'js');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('array');
    });

    it('should reject invalid selection in array', () => {
      const field: A2UIField = {
        id: 'languages',
        type: 'multi_select',
        label: 'Languages',
        config: {
          options: [
            { value: 'js', label: 'JavaScript' },
            { value: 'ts', label: 'TypeScript' },
          ],
        },
      };

      const result = validateUserInput(field, ['js', 'invalid']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid selection');
    });

    it('should validate minSelections', () => {
      const field: A2UIField = {
        id: 'skills',
        type: 'multi_select',
        label: 'Skills',
        config: {
          options: [
            { value: 'js', label: 'JavaScript' },
            { value: 'ts', label: 'TypeScript' },
          ],
          minSelections: 1,
        },
      };

      expect(validateUserInput(field, ['js']).valid).toBe(true);
      const result = validateUserInput(field, []);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 1');
    });

    it('should validate maxSelections', () => {
      const field: A2UIField = {
        id: 'skills',
        type: 'multi_select',
        label: 'Skills',
        config: {
          options: [
            { value: 'js', label: 'JavaScript' },
            { value: 'ts', label: 'TypeScript' },
            { value: 'py', label: 'Python' },
          ],
          maxSelections: 2,
        },
      };

      expect(validateUserInput(field, ['js', 'ts']).valid).toBe(true);
      const result = validateUserInput(field, ['js', 'ts', 'py']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 2');
    });
  });

  describe('validateUserInput - required field handling', () => {
    it('should reject undefined for required field', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        required: true,
      };

      expect(validateUserInput(field, undefined).valid).toBe(false);
      expect(validateUserInput(field, null).valid).toBe(false);
    });

    it('should accept undefined for optional field', () => {
      const field: A2UIField = {
        id: 'name',
        type: 'text',
        label: 'Name',
        required: false,
      };

      expect(validateUserInput(field, undefined).valid).toBe(true);
      expect(validateUserInput(field, null).valid).toBe(true);
    });
  });
});
