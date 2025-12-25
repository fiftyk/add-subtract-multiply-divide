import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlannerImpl } from '../planner.js';
import { FunctionRegistry, defineFunction } from '../../registry/index.js';
import { LocalFunctionToolProvider, StandardToolFormatter } from '../../tools/index.js';
import type { ExecutionPlan } from '../types.js';
import type { IPlannerLLMClient } from '../interfaces/IPlannerLLMClient.js';

// Mock LLM Client for testing
class MockLLMClient implements IPlannerLLMClient {
  async generatePlan(prompt: string): Promise<string> {
    // This will be mocked in tests
    return '';
  }
}

describe('Planner', () => {
  let planner: PlannerImpl;
  let registry: FunctionRegistry;
  let mockLLMClient: MockLLMClient;
  let toolProvider: LocalFunctionToolProvider;
  let toolFormatter: StandardToolFormatter;

  beforeEach(() => {
    registry = new FunctionRegistry();
    mockLLMClient = new MockLLMClient();
    toolProvider = new LocalFunctionToolProvider(registry);
    toolFormatter = new StandardToolFormatter();

    // 注册测试用的数学函数
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

    planner = new PlannerImpl(toolProvider, toolFormatter, registry, mockLLMClient);
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
  });

  describe('validatePlan', () => {
    it('should validate that all referenced functions exist', () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'add',
            description: '',
            parameters: {},
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(planner.validatePlan(plan)).toBe(true);
    });

    it('should fail validation for non-existent functions', () => {
      const plan: ExecutionPlan = {
        id: 'plan-001',
        userRequest: 'test',
        steps: [
          {
            stepId: 1,
            functionName: 'nonexistent',
            description: '',
            parameters: {},
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'executable',
      };

      expect(planner.validatePlan(plan)).toBe(false);
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
