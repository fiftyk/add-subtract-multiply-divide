import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext } from '../context.js';
import {
  ParameterResolutionError,
  StepResultNotFoundError,
} from '../../errors/index.js';
import type { ParameterValue } from '../../planner/types.js';

describe('ExecutionContext', () => {
  let context: ExecutionContext;

  beforeEach(() => {
    context = new ExecutionContext();
  });

  describe('setStepResult() and getStepResult()', () => {
    it('should store and retrieve step result', () => {
      context.setStepResult(1, 42);
      expect(context.getStepResult(1)).toBe(42);
    });

    it('should store and retrieve object result', () => {
      const result = { name: 'John', age: 30 };
      context.setStepResult(2, result);
      expect(context.getStepResult(2)).toEqual(result);
    });

    it('should store and retrieve array result', () => {
      const result = [1, 2, 3];
      context.setStepResult(3, result);
      expect(context.getStepResult(3)).toEqual(result);
    });

    it('should return undefined for non-existent step', () => {
      expect(context.getStepResult(999)).toBeUndefined();
    });

    it('should overwrite existing step result', () => {
      context.setStepResult(1, 'first');
      context.setStepResult(1, 'second');
      expect(context.getStepResult(1)).toBe('second');
    });

    it('should handle multiple steps', () => {
      context.setStepResult(1, 'result1');
      context.setStepResult(2, 'result2');
      context.setStepResult(3, 'result3');

      expect(context.getStepResult(1)).toBe('result1');
      expect(context.getStepResult(2)).toBe('result2');
      expect(context.getStepResult(3)).toBe('result3');
    });
  });

  describe('resolveParameterValue() - literal values', () => {
    it('should resolve literal string value', () => {
      const param: ParameterValue = { type: 'literal', value: 'hello' };
      expect(context.resolveParameterValue(param)).toBe('hello');
    });

    it('should resolve literal number value', () => {
      const param: ParameterValue = { type: 'literal', value: 42 };
      expect(context.resolveParameterValue(param)).toBe(42);
    });

    it('should resolve literal boolean value', () => {
      const param: ParameterValue = { type: 'literal', value: true };
      expect(context.resolveParameterValue(param)).toBe(true);
    });

    it('should resolve literal null value', () => {
      const param: ParameterValue = { type: 'literal', value: null };
      expect(context.resolveParameterValue(param)).toBe(null);
    });

    it('should resolve literal object value', () => {
      const obj = { key: 'value' };
      const param: ParameterValue = { type: 'literal', value: obj };
      expect(context.resolveParameterValue(param)).toEqual(obj);
    });
  });

  describe('resolveParameterValue() - step.X.result reference', () => {
    it('should resolve step.X.result reference', () => {
      context.setStepResult(1, 'test-result');

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe('test-result');
    });

    it('should resolve reference to object result', () => {
      const result = { name: 'John', age: 30 };
      context.setStepResult(2, result);

      const param: ParameterValue = { type: 'reference', value: 'step.2.result' };
      expect(context.resolveParameterValue(param)).toEqual(result);
    });

    it('should resolve reference to array result', () => {
      const result = [1, 2, 3];
      context.setStepResult(3, result);

      const param: ParameterValue = { type: 'reference', value: 'step.3.result' };
      expect(context.resolveParameterValue(param)).toEqual(result);
    });

    it('should resolve reference to number result', () => {
      context.setStepResult(1, 42);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe(42);
    });
  });

  describe('resolveParameterValue() - step.X.fieldName reference', () => {
    it('should resolve top-level field from object result', () => {
      context.setStepResult(1, { name: 'Alice', age: 25 });

      const nameParam: ParameterValue = { type: 'reference', value: 'step.1.name' };
      const ageParam: ParameterValue = { type: 'reference', value: 'step.1.age' };

      expect(context.resolveParameterValue(nameParam)).toBe('Alice');
      expect(context.resolveParameterValue(ageParam)).toBe(25);
    });

    it('should resolve nested field path', () => {
      context.setStepResult(1, {
        user: {
          profile: {
            name: 'Bob',
            location: 'NYC',
          },
        },
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.user.profile.name',
      };
      expect(context.resolveParameterValue(param)).toBe('Bob');
    });

    it('should resolve array element by index', () => {
      context.setStepResult(1, {
        items: ['apple', 'banana', 'cherry'],
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.items.1',
      };
      expect(context.resolveParameterValue(param)).toBe('banana');
    });

    it('should resolve nested object in array', () => {
      context.setStepResult(1, {
        patents: [
          { id: 'P1', title: 'First Patent' },
          { id: 'P2', title: 'Second Patent' },
        ],
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.patents.0.title',
      };
      expect(context.resolveParameterValue(param)).toBe('First Patent');
    });

    it('should resolve deeply nested path', () => {
      context.setStepResult(1, {
        data: {
          results: {
            patents: [
              {
                inventor: {
                  name: 'John Doe',
                  country: 'US',
                },
              },
            ],
          },
        },
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.data.results.patents.0.inventor.name',
      };
      expect(context.resolveParameterValue(param)).toBe('John Doe');
    });
  });

  describe('resolveParameterValue() - step.X.result.fieldName reference (backward compatibility)', () => {
    it('should resolve step.X.result.fieldName format', () => {
      context.setStepResult(1, { inventor: 'Tesla' });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.result.inventor',
      };
      expect(context.resolveParameterValue(param)).toBe('Tesla');
    });

    it('should resolve nested path with result prefix', () => {
      context.setStepResult(1, {
        user: {
          name: 'Alice',
        },
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.result.user.name',
      };
      expect(context.resolveParameterValue(param)).toBe('Alice');
    });
  });

  describe('resolveParameterValue() - error cases', () => {
    it('should throw ParameterResolutionError for invalid reference format', () => {
      const invalidRefs = [
        'invalid',
        'step',
        'step.1',
        'step.abc.result',
        'result.1',
        'step1.result',
      ];

      for (const ref of invalidRefs) {
        const param: ParameterValue = { type: 'reference', value: ref };
        expect(() => context.resolveParameterValue(param)).toThrow(
          ParameterResolutionError
        );
        expect(() => context.resolveParameterValue(param)).toThrow(
          /Invalid parameter reference format/
        );
      }
    });

    it('should throw StepResultNotFoundError when step does not exist', () => {
      const param: ParameterValue = { type: 'reference', value: 'step.999.result' };

      expect(() => context.resolveParameterValue(param)).toThrow(
        StepResultNotFoundError
      );
      expect(() => context.resolveParameterValue(param)).toThrow(
        /Result for step 999 does not exist/
      );
    });

    it('should include available steps in error when step not found', () => {
      context.setStepResult(1, 'result1');
      context.setStepResult(2, 'result2');

      const param: ParameterValue = { type: 'reference', value: 'step.3.result' };

      try {
        context.resolveParameterValue(param);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(StepResultNotFoundError);
        if (error instanceof StepResultNotFoundError) {
          expect(error.context?.availableSteps).toEqual([1, 2]);
        }
      }
    });

    it('should throw ParameterResolutionError when field does not exist', () => {
      context.setStepResult(1, { name: 'John' });

      const param: ParameterValue = { type: 'reference', value: 'step.1.age' };

      expect(() => context.resolveParameterValue(param)).toThrow(
        ParameterResolutionError
      );
      expect(() => context.resolveParameterValue(param)).toThrow(
        /Field "age" not found/
      );
    });

    it('should throw ParameterResolutionError when accessing field on non-object', () => {
      context.setStepResult(1, 42); // primitive value

      const param: ParameterValue = { type: 'reference', value: 'step.1.field' };

      expect(() => context.resolveParameterValue(param)).toThrow(
        ParameterResolutionError
      );
      expect(() => context.resolveParameterValue(param)).toThrow(
        /result is not an object/
      );
    });

    it('should throw ParameterResolutionError when nested path traverses non-object', () => {
      context.setStepResult(1, {
        value: 'string',
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.value.nested',
      };

      expect(() => context.resolveParameterValue(param)).toThrow(
        ParameterResolutionError
      );
      expect(() => context.resolveParameterValue(param)).toThrow(
        /Cannot access field "nested"/
      );
    });

    it('should throw ParameterResolutionError when nested path encounters null', () => {
      context.setStepResult(1, {
        data: null,
      });

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.1.data.field',
      };

      expect(() => context.resolveParameterValue(param)).toThrow(
        ParameterResolutionError
      );
      expect(() => context.resolveParameterValue(param)).toThrow(
        /Cannot access field "field"/
      );
    });
  });

  describe('resolveParameters()', () => {
    it('should resolve empty parameters object', () => {
      const params = {};
      expect(context.resolveParameters(params)).toEqual({});
    });

    it('should resolve all literal parameters', () => {
      const params: Record<string, ParameterValue> = {
        name: { type: 'literal', value: 'Alice' },
        age: { type: 'literal', value: 30 },
        active: { type: 'literal', value: true },
      };

      expect(context.resolveParameters(params)).toEqual({
        name: 'Alice',
        age: 30,
        active: true,
      });
    });

    it('should resolve mixed literal and reference parameters', () => {
      context.setStepResult(1, { result: 'previous-result' });

      const params: Record<string, ParameterValue> = {
        literal: { type: 'literal', value: 'fixed-value' },
        reference: { type: 'reference', value: 'step.1.result' },
      };

      expect(context.resolveParameters(params)).toEqual({
        literal: 'fixed-value',
        reference: { result: 'previous-result' },
      });
    });

    it('should resolve multiple references to different steps', () => {
      context.setStepResult(1, 'result1');
      context.setStepResult(2, 'result2');
      context.setStepResult(3, 'result3');

      const params: Record<string, ParameterValue> = {
        a: { type: 'reference', value: 'step.1.result' },
        b: { type: 'reference', value: 'step.2.result' },
        c: { type: 'reference', value: 'step.3.result' },
      };

      expect(context.resolveParameters(params)).toEqual({
        a: 'result1',
        b: 'result2',
        c: 'result3',
      });
    });

    it('should resolve field references from object results', () => {
      context.setStepResult(1, {
        user: 'John',
        score: 95,
      });

      const params: Record<string, ParameterValue> = {
        username: { type: 'reference', value: 'step.1.user' },
        points: { type: 'reference', value: 'step.1.score' },
      };

      expect(context.resolveParameters(params)).toEqual({
        username: 'John',
        points: 95,
      });
    });

    it('should throw error if any parameter resolution fails', () => {
      const params: Record<string, ParameterValue> = {
        valid: { type: 'literal', value: 'ok' },
        invalid: { type: 'reference', value: 'step.999.result' },
      };

      expect(() => context.resolveParameters(params)).toThrow(
        StepResultNotFoundError
      );
    });
  });

  describe('clear()', () => {
    it('should clear all stored results', () => {
      context.setStepResult(1, 'result1');
      context.setStepResult(2, 'result2');
      context.setStepResult(3, 'result3');

      context.clear();

      expect(context.getStepResult(1)).toBeUndefined();
      expect(context.getStepResult(2)).toBeUndefined();
      expect(context.getStepResult(3)).toBeUndefined();
    });

    it('should allow adding new results after clear', () => {
      context.setStepResult(1, 'old-result');
      context.clear();
      context.setStepResult(1, 'new-result');

      expect(context.getStepResult(1)).toBe('new-result');
    });

    it('should not throw error when clearing empty context', () => {
      expect(() => context.clear()).not.toThrow();
    });

    it('should make references fail after clear', () => {
      context.setStepResult(1, 'result');

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe('result');

      context.clear();

      expect(() => context.resolveParameterValue(param)).toThrow(
        StepResultNotFoundError
      );
    });
  });

  describe('resolveParameterValue() - composite type', () => {
    it('should resolve composite parameter with nested references', () => {
      context.setStepResult(1, { category: '电子产品', quantity: 5 });
      context.setStepResult(2, { color: '黑色', size: 'M' });
      context.setStepResult(3, { finalPrice: 2450 });

      const param: ParameterValue = {
        type: 'composite',
        value: {
          productInfo: {
            type: 'composite',
            value: {
              category: { type: 'reference', value: 'step.1.category' },
              quantity: { type: 'reference', value: 'step.1.quantity' },
            },
          },
          specs: { type: 'reference', value: 'step.2.result' },
          payment: {
            type: 'composite',
            value: {
              finalPrice: { type: 'reference', value: 'step.3.finalPrice' },
              method: { type: 'literal', value: '支付宝' },
            },
          },
        },
      };

      const resolved = context.resolveParameterValue(param);

      expect(resolved).toEqual({
        productInfo: {
          category: '电子产品',
          quantity: 5,
        },
        specs: { color: '黑色', size: 'M' },
        payment: {
          finalPrice: 2450,
          method: '支付宝',
        },
      });
    });

    it('should resolve composite parameter with only literals', () => {
      const param: ParameterValue = {
        type: 'composite',
        value: {
          name: { type: 'literal', value: 'Test' },
          count: { type: 'literal', value: 10 },
        },
      };

      expect(context.resolveParameterValue(param)).toEqual({
        name: 'Test',
        count: 10,
      });
    });

    it('should resolve deeply nested composite structures', () => {
      context.setStepResult(1, { basePrice: 2250 });

      const param: ParameterValue = {
        type: 'composite',
        value: {
          level1: {
            type: 'composite',
            value: {
              level2: {
                type: 'composite',
                value: {
                  price: { type: 'reference', value: 'step.1.basePrice' },
                  discount: { type: 'literal', value: 0.1 },
                },
              },
            },
          },
        },
      };

      expect(context.resolveParameterValue(param)).toEqual({
        level1: {
          level2: {
            price: 2250,
            discount: 0.1,
          },
        },
      });
    });
  });

  describe('edge cases and special values', () => {
    it('should handle null as step result', () => {
      context.setStepResult(1, null);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe(null);
    });

    it('should treat undefined as step result as non-existent (current behavior)', () => {
      // Note: Due to Map.get() returning undefined for both missing keys
      // and keys with undefined values, the current implementation treats
      // undefined results as non-existent steps
      context.setStepResult(1, undefined);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };

      // Current behavior: throws StepResultNotFoundError
      expect(() => context.resolveParameterValue(param)).toThrow(
        StepResultNotFoundError
      );
    });

    it('should handle zero as step result', () => {
      context.setStepResult(1, 0);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe(0);
    });

    it('should handle empty string as step result', () => {
      context.setStepResult(1, '');

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe('');
    });

    it('should handle false as step result', () => {
      context.setStepResult(1, false);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toBe(false);
    });

    it('should handle empty object as step result', () => {
      context.setStepResult(1, {});

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toEqual({});
    });

    it('should handle empty array as step result', () => {
      context.setStepResult(1, []);

      const param: ParameterValue = { type: 'reference', value: 'step.1.result' };
      expect(context.resolveParameterValue(param)).toEqual([]);
    });

    it('should handle accessing 0 field in object', () => {
      context.setStepResult(1, { 0: 'zero-field' });

      const param: ParameterValue = { type: 'reference', value: 'step.1.0' };
      expect(context.resolveParameterValue(param)).toBe('zero-field');
    });

    it('should handle large step IDs', () => {
      context.setStepResult(999999, 'large-id-result');

      const param: ParameterValue = {
        type: 'reference',
        value: 'step.999999.result',
      };
      expect(context.resolveParameterValue(param)).toBe('large-id-result');
    });
  });
});
