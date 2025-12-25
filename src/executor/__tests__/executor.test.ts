import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutorImpl } from '../executor.js';
import type { Executor } from '../interfaces/Executor.js';
import { ExecutionContext } from '../context.js';
import { FunctionRegistry, defineFunction } from '../../registry/index.js';
import type { ExecutionPlan } from '../../planner/types.js';
import { StepType } from '../../planner/types.js';
import { isFunctionCallStep } from '../../planner/type-guards.js';
import { ConfigManager } from '../../config/index.js';

// 初始化 ConfigManager（用于 ExecutorImpl）
ConfigManager.initialize({ apiKey: 'test-key' });

describe('ExecutionContext', () => {
  let context: ExecutionContext;

  beforeEach(() => {
    context = new ExecutionContext();
  });

  it('should store and retrieve step results', () => {
    context.setStepResult(1, 10);
    expect(context.getStepResult(1)).toBe(10);
  });

  it('should return undefined for non-existent step', () => {
    expect(context.getStepResult(999)).toBeUndefined();
  });

  it('should resolve literal parameter values', () => {
    const value = context.resolveParameterValue({
      type: 'literal',
      value: 42,
    });
    expect(value).toBe(42);
  });

  it('should resolve reference parameter values', () => {
    context.setStepResult(1, 100);
    const value = context.resolveParameterValue({
      type: 'reference',
      value: 'step.1.result',
    });
    expect(value).toBe(100);
  });

  it('should throw for invalid reference', () => {
    expect(() =>
      context.resolveParameterValue({
        type: 'reference',
        value: 'step.999.result',
      })
    ).toThrow('Result for step 999 does not exist');
  });
});

describe('Executor', () => {
  let executor: Executor;
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();

    registry.register(
      defineFunction({
        name: 'add',
        description: '加法',
        scenario: '加',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '' },
        implementation: (a: number, b: number) => a + b,
      })
    );

    registry.register(
      defineFunction({
        name: 'subtract',
        description: '减法',
        scenario: '减',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '' },
        implementation: (a: number, b: number) => a - b,
      })
    );

    registry.register(
      defineFunction({
        name: 'multiply',
        description: '乘法',
        scenario: '乘',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '' },
        implementation: (a: number, b: number) => a * b,
      })
    );

    registry.register(
      defineFunction({
        name: 'divide',
        description: '除法',
        scenario: '除',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '' },
        implementation: (a: number, b: number) => {
          if (b === 0) throw new Error('除数不能为0');
          return a / b;
        },
      })
    );

    // 添加异步函数用于测试
    registry.register(
      defineFunction({
        name: 'asyncAdd',
        description: '异步加法',
        scenario: '异步计算',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '' },
        implementation: async (a: number, b: number) => {
          // 模拟异步操作
          await new Promise((resolve) => setTimeout(resolve, 10));
          return a + b;
        },
      })
    );

    executor = new ExecutorImpl(registry);
  });

  describe('execute', () => {
    it('should execute a single-step plan', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: '3 + 5',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: '加法',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.finalResult).toBe(8);
      expect(result.steps).toHaveLength(1);

      const step0 = result.steps[0];
      if (isFunctionCallStep(step0)) {
        expect(step0.result).toBe(8);
      }
    });

    it('should execute a multi-step plan with references', async () => {
      // (3 + 5) * 2 = 16
      const plan: ExecutionPlan = {
        id: 'plan-002',
        userRequest: '(3 + 5) * 2',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: '3 + 5',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: '* 2',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.finalResult).toBe(16);
      expect((result.steps[0] as any).result).toBe(8);
      expect((result.steps[1] as any).result).toBe(16);
    });

    it('should handle execution errors', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-003',
        userRequest: '10 / 0',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: '除法',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 0 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[0].error).toContain('除数不能为0');
    });

    it('should execute complex chained operations', async () => {
      // ((10 - 3) * 4) / 2 = 14
      const plan: ExecutionPlan = {
        id: 'plan-004',
        userRequest: '((10 - 3) * 4) / 2',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'subtract',
            description: '10 - 3',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 3 },
            },
          },
          {
            stepId: 2,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: '* 4',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 4 },
            },
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: '/ 2',
            parameters: {
              a: { type: 'reference', value: 'step.2.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect((result.steps[0] as any).result).toBe(7); // 10 - 3
      expect((result.steps[1] as any).result).toBe(28); // 7 * 4
      expect((result.steps[2] as any).result).toBe(14); // 28 / 2
      expect(result.finalResult).toBe(14);
    });

    it('should execute async functions', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-005',
        userRequest: 'async 3 + 5',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'asyncAdd',
            description: '异步加法',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.finalResult).toBe(8);
      expect((result.steps[0] as any).result).toBe(8);
    });

    it('should execute mixed sync and async functions in chain', async () => {
      // (async 3 + 5) * 2 = 16
      const plan: ExecutionPlan = {
        id: 'plan-006',
        userRequest: '(async 3 + 5) * 2',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'asyncAdd',
            description: 'async add',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: '* 2',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect((result.steps[0] as any).result).toBe(8);
      expect((result.steps[1] as any).result).toBe(16);
      expect(result.finalResult).toBe(16);
    });

    it('should timeout if step takes too long', async () => {
      // 注册一个慢速函数
      registry.register(
        defineFunction({
          name: 'slowFunction',
          description: '慢速函数',
          scenario: '测试超时',
          parameters: [
            { name: 'delay', type: 'number', description: '延迟时间' },
          ],
          returns: { type: 'number', description: '结果' },
          implementation: async (delay: number) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return 42;
          },
        })
      );

      // 创建一个超时时间为 100ms 的 executor
      const executorWithTimeout = new ExecutorImpl(registry, { stepTimeout: 100 });

      const plan: ExecutionPlan = {
        id: 'plan-timeout',
        userRequest: 'slow operation',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'slowFunction',
            description: '慢操作',
            parameters: {
              delay: { type: 'literal', value: 200 }, // 延迟 200ms，超过 100ms 超时
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executorWithTimeout.execute(plan);

      expect(result.success).toBe(false);
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[0].error).toContain('timed out');
    });

    it('should not timeout with stepTimeout set to 0', async () => {
      // 注册一个慢速函数
      registry.register(
        defineFunction({
          name: 'slowFunction2',
          description: '慢速函数2',
          scenario: '测试无超时限制',
          parameters: [
            { name: 'delay', type: 'number', description: '延迟时间' },
          ],
          returns: { type: 'number', description: '结果' },
          implementation: async (delay: number) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return 99;
          },
        })
      );

      // 创建一个不限制超时的 executor
      const executorNoTimeout = new ExecutorImpl(registry, { stepTimeout: 0 });

      const plan: ExecutionPlan = {
        id: 'plan-no-timeout',
        userRequest: 'slow operation without timeout',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'slowFunction2',
            description: '慢操作',
            parameters: {
              delay: { type: 'literal', value: 50 }, // 50ms 延迟
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executorNoTimeout.execute(plan);

      expect(result.success).toBe(true);
      expect((result.steps[0] as any).result).toBe(99);
    });

    it('should use default timeout of 30 seconds', () => {
      const defaultExecutor = new ExecutorImpl(registry);
      // 通过访问 private 属性来验证默认值（仅用于测试）
      expect((defaultExecutor as any).config.stepTimeout).toBe(30000);
    });
  });

  describe('formatResultForDisplay', () => {
    it('should format successful result', async () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: '3 + 5',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: '加法',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const result = await executor.execute(plan);
      const display = executor.formatResultForDisplay(result);

      expect(display).toContain('✅');
      expect(display).toContain('8');
    });
  });
});
