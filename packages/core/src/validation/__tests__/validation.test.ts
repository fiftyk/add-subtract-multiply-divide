import { describe, it, expect } from 'vitest';
import {
  TypeValidator,
  PlanValidator,
  ParameterValidationError,
  PlanValidationError,
} from '../index.js';
import { defineFunction } from '../../registry/index.js';
import type { ExecutionPlan } from '../../planner/types.js';

describe('TypeValidator', () => {
  describe('validateParameter', () => {
    it('should validate string parameters', () => {
      expect(() => TypeValidator.validateParameter('name', 'test', 'string')).not.toThrow();
      expect(() => TypeValidator.validateParameter('name', 123, 'string')).toThrow(
        ParameterValidationError
      );
    });

    it('should validate number parameters', () => {
      expect(() => TypeValidator.validateParameter('age', 25, 'number')).not.toThrow();
      expect(() => TypeValidator.validateParameter('age', '25', 'number')).toThrow(
        ParameterValidationError
      );
      expect(() => TypeValidator.validateParameter('age', NaN, 'number')).toThrow(
        ParameterValidationError
      );
    });

    it('should validate boolean parameters', () => {
      expect(() => TypeValidator.validateParameter('flag', true, 'boolean')).not.toThrow();
      expect(() => TypeValidator.validateParameter('flag', 'true', 'boolean')).toThrow(
        ParameterValidationError
      );
    });

    it('should validate object parameters', () => {
      expect(() => TypeValidator.validateParameter('data', { key: 'value' }, 'object')).not.toThrow();
      expect(() => TypeValidator.validateParameter('data', null, 'object')).toThrow(
        ParameterValidationError
      );
      expect(() => TypeValidator.validateParameter('data', 'string', 'object')).toThrow(
        ParameterValidationError
      );
    });

    it('should validate array parameters', () => {
      expect(() => TypeValidator.validateParameter('items', [1, 2, 3], 'array')).not.toThrow();
      expect(() => TypeValidator.validateParameter('items', { length: 3 }, 'array')).toThrow(
        ParameterValidationError
      );
    });

    it('should accept any type for "any" parameter', () => {
      expect(() => TypeValidator.validateParameter('value', 'string', 'any')).not.toThrow();
      expect(() => TypeValidator.validateParameter('value', 123, 'any')).not.toThrow();
      expect(() => TypeValidator.validateParameter('value', null, 'any')).not.toThrow();
    });

    it('should skip validation for unknown types', () => {
      expect(() => TypeValidator.validateParameter('value', 'test', 'CustomType')).not.toThrow();
    });
  });

  describe('validateFunctionParameters', () => {
    it('should validate all parameters are provided', () => {
      const fn = defineFunction({
        name: 'add',
        description: 'Add two numbers',
        scenario: 'Math',
        parameters: [
          { name: 'a', type: 'number', description: 'First number' },
          { name: 'b', type: 'number', description: 'Second number' },
        ],
        returns: { type: 'number', description: 'Sum' },
        implementation: (a: number, b: number) => a + b,
      });

      expect(() =>
        TypeValidator.validateFunctionParameters(fn, { a: 1, b: 2 })
      ).not.toThrow();

      expect(() =>
        TypeValidator.validateFunctionParameters(fn, { a: 1 })
      ).toThrow(ParameterValidationError);
    });

    it('should validate parameter types', () => {
      const fn = defineFunction({
        name: 'greet',
        description: 'Greet someone',
        scenario: 'Test',
        parameters: [
          { name: 'name', type: 'string', description: 'Name' },
          { name: 'age', type: 'number', description: 'Age' },
        ],
        returns: { type: 'string', description: 'Greeting' },
        implementation: (name: string, age: number) => `Hello ${name}, ${age}`,
      });

      expect(() =>
        TypeValidator.validateFunctionParameters(fn, { name: 'Alice', age: 30 })
      ).not.toThrow();

      expect(() =>
        TypeValidator.validateFunctionParameters(fn, { name: 'Alice', age: '30' })
      ).toThrow(ParameterValidationError);
    });
  });
});

describe('PlanValidator', () => {
  describe('validatePlan', () => {
    it('should validate valid plan', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'Calculate 3 + 5',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).not.toThrow();
    });

    it('should reject plan without ID', () => {
      const plan = {
        id: '',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'test',
            parameters: {},
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      } as ExecutionPlan;

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should reject plan without user request', () => {
      const plan = {
        id: 'plan-123',
        userRequest: '',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'executable',
      } as ExecutionPlan;

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should reject plan with empty steps', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should reject plan with invalid status', () => {
      const plan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'test',
            parameters: {},
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'invalid',
      } as any;

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should validate step references', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'First',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            functionName: 'multiply',
            description: 'Second',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).not.toThrow();
    });

    it('should reject forward references', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'First',
            parameters: {
              a: { type: 'reference', value: 'step.2.result' }, // Forward reference!
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            functionName: 'multiply',
            description: 'Second',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should reject non-existent step references', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'First',
            parameters: {
              a: { type: 'reference', value: 'step.999.result' }, // Non-existent!
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });

    it('should reject invalid reference format', () => {
      const plan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: 'First',
            parameters: {
              a: { type: 'reference', value: 'invalid.reference' }, // Bad format!
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(() => PlanValidator.validatePlan(plan)).toThrow(PlanValidationError);
    });
  });
});
