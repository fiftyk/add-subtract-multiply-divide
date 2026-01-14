/**
 * A2UI BoundValue Resolution Tests
 * TDD tests for BoundValue resolution functions
 */

import { describe, it, expect } from 'vitest';
import { resolveBoundValue, resolvePath, isLiteralValue, getLiteralValue } from '../A2UIService.js';

describe('BoundValue Resolution', () => {
  describe('resolveBoundValue', () => {
    it('should resolve literalString directly', () => {
      const boundValue = { literalString: '静态文本' };
      const result = resolveBoundValue(boundValue, {});
      expect(result).toBe('静态文本');
    });

    it('should resolve literalNumber directly', () => {
      const boundValue = { literalNumber: 42 };
      const result = resolveBoundValue(boundValue, {});
      expect(result).toBe(42);
    });

    it('should resolve literalBoolean directly', () => {
      const boundValue = { literalBoolean: true };
      const result = resolveBoundValue(boundValue, {});
      expect(result).toBe(true);
    });

    it('should resolve literalArray directly', () => {
      const boundValue = { literalArray: ['a', 'b', 'c'] };
      const result = resolveBoundValue(boundValue, {});
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should resolve path to nested value', () => {
      const boundValue = { path: '/step1/input/keyword' };
      const context = {
        step1: {
          input: {
            keyword: '机器学习'
          }
        }
      };
      const result = resolveBoundValue(boundValue, context);
      expect(result).toBe('机器学习');
    });

    it('should resolve deeply nested path', () => {
      const boundValue = { path: '/step2/result/query_response/docs/0/PN_STR' };
      const context = {
        step2: {
          result: {
            query_response: {
              docs: [{ _id: '1', PN_STR: 'CN123456' }]
            }
          }
        }
      };
      const result = resolveBoundValue(boundValue, context);
      expect(result).toBe('CN123456');
    });

    it('should return undefined for invalid path', () => {
      const boundValue = { path: '/step999/nonexistent' };
      const context = {
        step1: { input: { keyword: 'test' } }
      };
      const result = resolveBoundValue(boundValue, context);
      expect(result).toBeUndefined();
    });

    it('should return undefined for null context', () => {
      const boundValue = { path: '/step1/input' };
      const result = resolveBoundValue(boundValue, null as any);
      expect(result).toBeUndefined();
    });
  });

  describe('resolvePath', () => {
    it('should resolve root path to context', () => {
      const context = { data: 'value' };
      const result = resolvePath('/', context);
      expect(result).toBe(context);
    });

    it('should resolve single level path', () => {
      const context = { name: 'test' };
      const result = resolvePath('/name', context);
      expect(result).toBe('test');
    });

    it('should resolve multi-level path', () => {
      const context = {
        a: {
          b: {
            c: 'deep value'
          }
        }
      };
      const result = resolvePath('/a/b/c', context);
      expect(result).toBe('deep value');
    });

    it('should handle array index', () => {
      const context = {
        items: [{ id: '1' }, { id: '2' }]
      };
      const result = resolvePath('/items/0', context);
      expect(result).toEqual({ id: '1' });
    });

    it('should return undefined for non-existent path', () => {
      const context = { a: { b: 'value' } };
      const result = resolvePath('/a/c', context);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty path', () => {
      const context = { data: 'value' };
      const result = resolvePath('', context);
      expect(result).toBeUndefined();
    });

    it('should return undefined for path not starting with /', () => {
      const context = { data: 'value' };
      const result = resolvePath('data', context);
      expect(result).toBeUndefined();
    });
  });

  describe('isLiteralValue', () => {
    it('should return true for literalString', () => {
      expect(isLiteralValue({ literalString: 'test' })).toBe(true);
    });

    it('should return true for literalNumber', () => {
      expect(isLiteralValue({ literalNumber: 42 })).toBe(true);
    });

    it('should return true for literalBoolean', () => {
      expect(isLiteralValue({ literalBoolean: true })).toBe(true);
    });

    it('should return false for path', () => {
      expect(isLiteralValue({ path: '/data' })).toBe(false);
    });

    it('should return false for literalArray', () => {
      expect(isLiteralValue({ literalArray: ['a', 'b'] })).toBe(false);
    });
  });

  describe('getLiteralValue', () => {
    it('should get literalString', () => {
      const result = getLiteralValue<string>(({ literalString: 'test' }));
      expect(result).toBe('test');
    });

    it('should get literalNumber', () => {
      const result = getLiteralValue<number>(({ literalNumber: 42 }));
      expect(result).toBe(42);
    });

    it('should get literalBoolean', () => {
      const result = getLiteralValue<boolean>(({ literalBoolean: true }));
      expect(result).toBe(true);
    });

    it('should return undefined for path', () => {
      const result = getLiteralValue<string>(({ path: '/data' }));
      expect(result).toBeUndefined();
    });
  });
});

describe('BoundValue Resolution - Real World Scenarios', () => {
  describe('Patent Research Plan Scenario', () => {
    const executionContext = {
      step1: {
        input: {
          keyword: '机器学习',
          rows: 10
        }
      },
      step2: {
        result: {
          query_response: {
            docs: [
              { _id: '1', PN_STR: 'CN123456A', title: '专利1' },
              { _id: '2', PN_STR: 'CN789012A', title: '专利2' }
            ]
          }
        }
      }
    };

    it('should resolve user input keyword', () => {
      const boundValue = { path: '/step1/input/keyword' };
      const result = resolveBoundValue(boundValue, executionContext);
      expect(result).toBe('机器学习');
    });

    it('should resolve search results list', () => {
      const boundValue = { path: '/step2/result/query_response/docs' };
      const result = resolveBoundValue(boundValue, executionContext);
      expect(result).toHaveLength(2);
      expect((result as Array<{ _id: string }>)[0]._id).toBe('1');
    });

    it('should resolve first patent ID', () => {
      const boundValue = { path: '/step2/result/query_response/docs/0/PN_STR' };
      const result = resolveBoundValue(boundValue, executionContext);
      expect(result).toBe('CN123456A');
    });
  });
});
