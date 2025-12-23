import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry, defineFunction } from '../src/registry/index.js';
import { Executor } from '../src/executor/index.js';
import type { ExecutionPlan } from '../src/planner/types.js';

describe('E2E: 加减乘除计算', () => {
  let registry: FunctionRegistry;
  let executor: Executor;

  beforeEach(() => {
    registry = new FunctionRegistry();

    // 注册加减乘除函数
    registry.register(
      defineFunction({
        name: 'add',
        description: '将两个数字相加',
        scenario: '当需要计算两个数的和时使用',
        parameters: [
          { name: 'a', type: 'number', description: '第一个加数' },
          { name: 'b', type: 'number', description: '第二个加数' },
        ],
        returns: { type: 'number', description: '两数之和' },
        implementation: (a: number, b: number) => a + b,
      })
    );

    registry.register(
      defineFunction({
        name: 'subtract',
        description: '将两个数字相减',
        scenario: '当需要计算两个数的差时使用',
        parameters: [
          { name: 'a', type: 'number', description: '被减数' },
          { name: 'b', type: 'number', description: '减数' },
        ],
        returns: { type: 'number', description: '两数之差' },
        implementation: (a: number, b: number) => a - b,
      })
    );

    registry.register(
      defineFunction({
        name: 'multiply',
        description: '将两个数字相乘',
        scenario: '当需要计算两个数的积时使用',
        parameters: [
          { name: 'a', type: 'number', description: '第一个因数' },
          { name: 'b', type: 'number', description: '第二个因数' },
        ],
        returns: { type: 'number', description: '两数之积' },
        implementation: (a: number, b: number) => a * b,
      })
    );

    registry.register(
      defineFunction({
        name: 'divide',
        description: '将两个数字相除',
        scenario: '当需要计算两个数的商时使用',
        parameters: [
          { name: 'a', type: 'number', description: '被除数' },
          { name: 'b', type: 'number', description: '除数' },
        ],
        returns: { type: 'number', description: '两数之商' },
        implementation: (a: number, b: number) => {
          if (b === 0) throw new Error('除数不能为0');
          return a / b;
        },
      })
    );

    executor = new Executor(registry);
  });

  it('计算 3 + 5 = 8', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-add',
      userRequest: '计算 3 + 5',
      steps: [
        {
          stepId: 1,
          functionName: 'add',
          description: '计算 3 + 5',
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
  });

  it('计算 10 - 3 = 7', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-subtract',
      userRequest: '计算 10 - 3',
      steps: [
        {
          stepId: 1,
          functionName: 'subtract',
          description: '计算 10 - 3',
          parameters: {
            a: { type: 'literal', value: 10 },
            b: { type: 'literal', value: 3 },
          },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    const result = await executor.execute(plan);

    expect(result.success).toBe(true);
    expect(result.finalResult).toBe(7);
  });

  it('计算 4 * 6 = 24', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-multiply',
      userRequest: '计算 4 * 6',
      steps: [
        {
          stepId: 1,
          functionName: 'multiply',
          description: '计算 4 * 6',
          parameters: {
            a: { type: 'literal', value: 4 },
            b: { type: 'literal', value: 6 },
          },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    const result = await executor.execute(plan);

    expect(result.success).toBe(true);
    expect(result.finalResult).toBe(24);
  });

  it('计算 20 / 4 = 5', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-divide',
      userRequest: '计算 20 / 4',
      steps: [
        {
          stepId: 1,
          functionName: 'divide',
          description: '计算 20 / 4',
          parameters: {
            a: { type: 'literal', value: 20 },
            b: { type: 'literal', value: 4 },
          },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'executable',
    };

    const result = await executor.execute(plan);

    expect(result.success).toBe(true);
    expect(result.finalResult).toBe(5);
  });

  it('计算 (3 + 5) * 2 = 16', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-complex',
      userRequest: '计算 (3 + 5) * 2',
      steps: [
        {
          stepId: 1,
          functionName: 'add',
          description: '先计算 3 + 5',
          parameters: {
            a: { type: 'literal', value: 3 },
            b: { type: 'literal', value: 5 },
          },
        },
        {
          stepId: 2,
          functionName: 'multiply',
          description: '将结果乘以 2',
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
    expect(result.steps[0].result).toBe(8); // 3 + 5
    expect(result.steps[1].result).toBe(16); // 8 * 2
    expect(result.finalResult).toBe(16);
  });

  it('计算 ((10 - 3) * 4) / 2 = 14', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-chain',
      userRequest: '计算 ((10 - 3) * 4) / 2',
      steps: [
        {
          stepId: 1,
          functionName: 'subtract',
          description: '10 - 3',
          parameters: {
            a: { type: 'literal', value: 10 },
            b: { type: 'literal', value: 3 },
          },
        },
        {
          stepId: 2,
          functionName: 'multiply',
          description: '* 4',
          parameters: {
            a: { type: 'reference', value: 'step.1.result' },
            b: { type: 'literal', value: 4 },
          },
        },
        {
          stepId: 3,
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
    expect(result.steps[0].result).toBe(7); // 10 - 3
    expect(result.steps[1].result).toBe(28); // 7 * 4
    expect(result.steps[2].result).toBe(14); // 28 / 2
    expect(result.finalResult).toBe(14);
  });

  it('处理除数为0的错误', async () => {
    const plan: ExecutionPlan = {
      id: 'e2e-error',
      userRequest: '计算 10 / 0',
      steps: [
        {
          stepId: 1,
          functionName: 'divide',
          description: '10 / 0',
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
});

describe('E2E: 缺口识别', () => {
  it('识别缺失的函数', () => {
    const registry = new FunctionRegistry();

    // 只注册加法
    registry.register(
      defineFunction({
        name: 'add',
        description: '加法',
        scenario: '加',
        parameters: [],
        returns: { type: 'number', description: '' },
        implementation: () => 0,
      })
    );

    // 验证 sqrt 不存在
    expect(registry.has('sqrt')).toBe(false);
    expect(registry.has('add')).toBe(true);

    // 模拟缺口识别结果
    const incompletePlan: ExecutionPlan = {
      id: 'e2e-incomplete',
      userRequest: '计算 9 的平方根',
      steps: [],
      missingFunctions: [
        {
          name: 'sqrt',
          description: '计算平方根',
          suggestedParameters: [
            { name: 'x', type: 'number', description: '要计算平方根的数' },
          ],
          suggestedReturns: { type: 'number', description: '平方根结果' },
        },
      ],
      createdAt: new Date().toISOString(),
      status: 'incomplete',
    };

    expect(incompletePlan.status).toBe('incomplete');
    expect(incompletePlan.missingFunctions).toHaveLength(1);
    expect(incompletePlan.missingFunctions?.[0].name).toBe('sqrt');
  });
});
