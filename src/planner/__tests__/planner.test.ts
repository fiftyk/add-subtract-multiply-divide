import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlannerImpl } from '../planner.js';
import { defineFunction } from '../../registry/index.js';
import { AllToolsSelector, StandardToolFormatter } from '../../tools/index.js';
import { LocalFunctionProvider } from '../../function-provider/index.js';
import type { ExecutionPlan } from '../types.js';
import type { PlannerLLMClient } from '../interfaces/PlannerLLMClient.js';

// Mock LLM Client for testing
class MockLLMClient implements PlannerLLMClient {
  async generatePlan(prompt: string): Promise<string> {
    // This will be mocked in tests
    return '';
  }
}

describe('Planner', () => {
  let planner: PlannerImpl;
  let functionProvider: LocalFunctionProvider;
  let mockLLMClient: MockLLMClient;
  let toolSelector: AllToolsSelector;
  let toolFormatter: StandardToolFormatter;

  beforeEach(() => {
    functionProvider = new LocalFunctionProvider();
    mockLLMClient = new MockLLMClient();
    toolSelector = new AllToolsSelector();
    toolFormatter = new StandardToolFormatter();

    // 注册测试用的数学函数
    functionProvider.register(
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

    functionProvider.register(
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

    planner = new PlannerImpl(functionProvider, toolSelector, toolFormatter, mockLLMClient);
  });

  describe('plan', () => {
    it('should create a simple single-step plan', async () => {
      // Mock LLM response for simple addition
      const mockResponse: ExecutionPlan = {
        id: 'plan-001',
        userRequest: '计算 3 + 5',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: '将 3 和 5 相加',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      vi.spyOn(planner, 'callLLM').mockResolvedValue(mockResponse);

      const result = await planner.plan('计算 3 + 5');

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan?.steps).toHaveLength(1);
      expect(result.plan?.steps[0].functionName).toBe('add');
    });

    it('should create a multi-step plan with references', async () => {
      // Mock LLM response for (3 + 5) * 2
      const mockResponse: ExecutionPlan = {
        id: 'plan-002',
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
            description: '将上一��结果乘以 2',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
            dependsOn: [1],
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      vi.spyOn(planner, 'callLLM').mockResolvedValue(mockResponse);

      const result = await planner.plan('计算 (3 + 5) * 2');

      expect(result.success).toBe(true);
      expect(result.plan?.steps).toHaveLength(2);
      expect(result.plan?.steps[1].parameters.a.type).toBe('reference');
      expect(result.plan?.steps[1].parameters.a.value).toBe('step.1.result');
    });

    it('should identify missing functions', async () => {
      // Mock LLM response for sqrt (not available)
      const mockResponse: ExecutionPlan = {
        id: 'plan-003',
        userRequest: '计算 9 的平方根',
        steps: [],
        missingFunctions: [
          {
            name: 'sqrt',
            description: '计算一个数的平方根',
            suggestedParameters: [
              { name: 'x', type: 'number', description: '要计算平方根的数' },
            ],
            suggestedReturns: { type: 'number', description: '平方根结果' },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'incomplete',
      };

      vi.spyOn(planner, 'callLLM').mockResolvedValue(mockResponse);

      const result = await planner.plan('计算 9 的平方根');

      expect(result.success).toBe(true);
      expect(result.plan?.status).toBe('incomplete');
      expect(result.plan?.missingFunctions).toHaveLength(1);
      expect(result.plan?.missingFunctions?.[0].name).toBe('sqrt');
    });

    it('should accept dynamically registered functions after plan generation', async () => {
      // 模拟场景：第一次 LLM 调用返回使用 sqrt 的计划
      const mockResponseWithSqrt: ExecutionPlan = {
        id: 'plan-004',
        userRequest: '计算 9 的平方根',
        steps: [
          {
            stepId: 1,
            functionName: 'sqrt',
            description: '计算 9 的平方根',
            parameters: {
              x: { type: 'literal', value: 9 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      vi.spyOn(planner, 'callLLM').mockResolvedValue(mockResponseWithSqrt);

      // 第一次调用应该失败（sqrt 未注册）
      const result1 = await planner.plan('计算 9 的平方根');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('计划中包含未注册的函数');

      // 模拟 mock 生成：动态注册 sqrt 函数
      functionProvider.register(
        defineFunction({
          name: 'sqrt',
          description: '计算一个数的平方根',
          scenario: '当需要计算平方根时使用',
          parameters: [
            { name: 'x', type: 'number', description: '要计算平方根的数' },
          ],
          returns: { type: 'number', description: '平方根结果' },
          implementation: (x: number) => Math.sqrt(x),
        })
      );

      // 第二次调用应该成功（sqrt 已动态注册）
      const result2 = await planner.plan('计算 9 的平方根');
      expect(result2.success).toBe(true);
      expect(result2.plan?.steps).toHaveLength(1);
      expect(result2.plan?.steps[0].functionName).toBe('sqrt');
      expect(result2.plan?.status).toBe('executable');
    });

    it('should validate against runtime registry state, not initial selectedTools', async () => {
      // 这个测试确保验证逻辑查询的是运行时的 FunctionProvider，而不是静态的 selectedTools 快照

      const mockResponseWithPower: ExecutionPlan = {
        id: 'plan-005',
        userRequest: '计算 2 的 3 次方',
        steps: [
          {
            stepId: 1,
            functionName: 'power',
            description: '计算 2 的 3 次方',
            parameters: {
              base: { type: 'literal', value: 2 },
              exponent: { type: 'literal', value: 3 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      // Mock callLLM to return plan using 'power' function
      vi.spyOn(planner, 'callLLM').mockResolvedValue(mockResponseWithPower);

      // 在调用 plan() 之前注册 power 函数（模拟 mock 生成器在 LLM 调用后立即注册）
      // 注意：实际场景中是 PlannerWithMockSupport 装饰器在检测到 missingFunctions 后注册
      // 但这里我们测试的是 validatePlan 能正确查询运行时状态

      // 首先验证 power 不存在
      expect(await functionProvider.has('power')).toBe(false);
      const result1 = await planner.plan('计算 2 的 3 次方');
      expect(result1.success).toBe(false);

      // 动态注册 power
      functionProvider.register(
        defineFunction({
          name: 'power',
          description: '计算幂运算',
          scenario: '当需要计算幂运算时使用',
          parameters: [
            { name: 'base', type: 'number', description: '底数' },
            { name: 'exponent', type: 'number', description: '指数' },
          ],
          returns: { type: 'number', description: '幂运算结果' },
          implementation: (base: number, exponent: number) => Math.pow(base, exponent),
        })
      );

      // 验证 power 现在存在
      expect(await functionProvider.has('power')).toBe(true);

      // 再次调用应该成功
      const result2 = await planner.plan('计算 2 的 3 次方');
      expect(result2.success).toBe(true);
      expect(result2.plan?.status).toBe('executable');
    });
  });

  describe('formatPlanForDisplay', () => {
    it('should format plan for CLI display', () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: '计算 3 + 5',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: '将 3 和 5 相加',
            parameters: {
              a: { type: 'literal', value: 3 },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      const display = planner.formatPlanForDisplay(plan);

      expect(display).toContain('plan-001');
      expect(display).toContain('add');
      expect(display).toContain('3');
      expect(display).toContain('5');
    });
  });
});
