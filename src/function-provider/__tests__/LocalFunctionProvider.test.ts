/**
 * LocalFunctionProvider 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { FunctionDefinition, ParameterDef, ReturnDef } from '../registry/types.js';
import type { FunctionMetadata, FunctionExecutionResult } from '../types.js';

// 导入尚未实现的类，测试应该编译失败或运行失败
// import { LocalFunctionProvider } from '../LocalFunctionProvider.js';

describe('LocalFunctionProvider', () => {
  // 创建测试用的函数定义
  const createTestFunction = (overrides: Partial<FunctionDefinition> = {}): FunctionDefinition => ({
    name: 'testFunction',
    description: 'A test function',
    scenario: 'Used for testing',
    parameters: [
      { name: 'x', type: 'number', description: 'First number', required: true },
      { name: 'y', type: 'number', description: 'Second number', required: true },
    ],
    returns: { type: 'number', description: 'Sum of x and y' },
    implementation: (x: number, y: number) => x + y,
    ...overrides,
  });

  describe('getType', () => {
    it('should return "local" as provider type', async () => {
      // 导入 LocalFunctionProvider（编译时会失败，因为还不存在）
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      expect(provider.getType()).toBe('local');
    });
  });

  describe('getSource', () => {
    it('should return "local" as source', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      expect(provider.getSource()).toBe('local');
    });
  });

  describe('register', () => {
    it('should register a function and make it available via list', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      const fn = createTestFunction({ name: 'add', implementation: (a: number, b: number) => a + b });

      provider.register(fn);

      const functions = await provider.list();
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('add');
    });

    it('should register multiple functions', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      provider.register(createTestFunction({ name: 'add', implementation: (a: number, b: number) => a + b }));
      provider.register(createTestFunction({ name: 'multiply', implementation: (a: number, b: number) => a * b }));

      const functions = await provider.list();
      expect(functions).toHaveLength(2);
    });

    it('should throw error when registering duplicate function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      const fn = createTestFunction({ name: 'duplicate' });

      provider.register(fn);

      // 重复注册应该抛出错误
      expect(() => provider.register(fn)).toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array when no functions registered', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      const functions = await provider.list();
      expect(functions).toEqual([]);
    });

    it('should return FunctionMetadata with correct structure', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      const fn = createTestFunction({
        name: 'calculate',
        description: 'Calculates something',
        scenario: 'Calculation scenario',
      });

      provider.register(fn);

      const functions = await provider.list();
      expect(functions).toHaveLength(1);
      expect(functions[0]).toMatchObject({
        name: 'calculate',
        description: 'Calculates something',
        scenario: 'Calculation scenario',
        type: 'local',
        source: 'local',
      });
    });
  });

  describe('has', () => {
    it('should return false for unregistered function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      const result = await provider.has('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true for registered function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({ name: 'exists' }));

      const result = await provider.has('exists');
      expect(result).toBe(true);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      const result = await provider.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return FunctionMetadata for registered function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      const fn = createTestFunction({
        name: 'getMe',
        description: 'Function to get',
      });
      provider.register(fn);

      const result = await provider.get('getMe');
      expect(result).toBeDefined();
      expect(result!.name).toBe('getMe');
      expect(result!.description).toBe('Function to get');
    });
  });

  describe('execute', () => {
    it('should return success=false when executing unregistered function', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      const result = await provider.execute('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Function not found');
    });

    it('should execute synchronous function successfully', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({
        name: 'add',
        implementation: (x: number, y: number) => x + y,
      }));

      const result = await provider.execute('add', { x: 3, y: 5 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(8);
    });

    it('should execute asynchronous function successfully', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({
        name: 'asyncAdd',
        implementation: async (x: number, y: number) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return x + y;
        },
      }));

      const result = await provider.execute('asyncAdd', { x: 3, y: 5 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(8);
    });

    it('should return FunctionExecutionResult with success=true on success', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({
        name: 'test',
        implementation: () => 'result',
      }));

      const result = await provider.execute('test', {});
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return FunctionExecutionResult with error on function error', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({
        name: 'throwError',
        implementation: () => {
          throw new Error('Test error');
        },
      }));

      const result = await provider.execute('throwError', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should include execution metadata in result', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();
      provider.register(createTestFunction({
        name: 'simple',
        implementation: () => 'done',
      }));

      const result = await provider.execute('simple', {});
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.provider).toBe('local');
      expect(result.metadata!.executionTime).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all registered functions', async () => {
      const { LocalFunctionProvider } = await import('../LocalFunctionProvider.js');
      const provider = new LocalFunctionProvider();

      provider.register(createTestFunction({ name: 'fn1' }));
      provider.register(createTestFunction({ name: 'fn2' }));

      expect(await provider.list()).toHaveLength(2);

      provider.clear();

      expect(await provider.list()).toHaveLength(0);
      expect(await provider.has('fn1')).toBe(false);
      expect(await provider.has('fn2')).toBe(false);
    });
  });
});
