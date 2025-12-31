/**
 * ConditionalExecutor 测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConditionalExecutor } from '../implementations/ConditionalExecutor.js';
import type { ExecutionPlan, FunctionCallStep, ConditionalStep } from '../../planner/types.js';
import { StepType } from '../../planner/types.js';
import type { FunctionProvider, FunctionExecutionResult } from '../../function-provider/types.js';
import type { ExecutionResult, ConditionalResult } from '../types.js';
import { ConfigManager } from '../../config/index.js';

// Initialize ConfigManager before tests
const originalEnv = { ...process.env };
beforeEach(() => {
  // Reset ConfigManager state
  ConfigManager.reset();
  // Set required environment variables
  process.env.ANTHROPIC_API_KEY = 'test-api-key';
  // Initialize ConfigManager
  ConfigManager.initialize();
});

afterEach(() => {
  ConfigManager.reset();
  process.env = originalEnv;
});

// Mock FunctionProvider
const createMockFunctionProvider = (): FunctionProvider => {
  const mockProvider: Partial<FunctionProvider> = {
    getType: () => 'local' as const,
    getSource: () => 'test',
    list: vi.fn().mockResolvedValue([]),
    has: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockImplementation((name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult> => {
      // Mock implementation for add function
      if (name === 'add') {
        const a = Number(params.a);
        const b = Number(params.b);
        return Promise.resolve({
          success: true,
          result: a + b,
          metadata: { executionTime: 1, provider: 'test' },
        });
      }
      // Mock implementation for multiply function
      if (name === 'multiply') {
        const a = Number(params.a);
        const b = Number(params.b);
        return Promise.resolve({
          success: true,
          result: a * b,
          metadata: { executionTime: 1, provider: 'test' },
        });
      }
      // Mock implementation for divide function
      if (name === 'divide') {
        const a = Number(params.a);
        const b = Number(params.b);
        if (b === 0) {
          return Promise.resolve({
            success: false,
            error: 'Division by zero',
            metadata: { executionTime: 1, provider: 'test' },
          });
        }
        return Promise.resolve({
          success: true,
          result: a / b,
          metadata: { executionTime: 1, provider: 'test' },
        });
      }
      // Mock implementation for subtract function
      if (name === 'subtract') {
        const a = Number(params.a);
        const b = Number(params.b);
        return Promise.resolve({
          success: true,
          result: a - b,
          metadata: { executionTime: 1, provider: 'test' },
        });
      }
      return Promise.resolve({
        success: false,
        error: `Unknown function: ${name}`,
        metadata: { executionTime: 0, provider: 'test' },
      });
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  return mockProvider as FunctionProvider;
};

describe('ConditionalExecutor', () => {
  let mockFunctionProvider: FunctionProvider;
  let executor: ConditionalExecutor;

  beforeEach(() => {
    mockFunctionProvider = createMockFunctionProvider();
    executor = new ConditionalExecutor(mockFunctionProvider, { logger: undefined });
  });

  describe('execute', () => {
    it('should execute plan with condition evaluating to true', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-1',
        userRequest: 'Test condition execution',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add two numbers',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 20 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if result > 25',
            condition: 'step1Result > 25',
            onTrue: [3],
            onFalse: [4],
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply by 2 (true branch)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: 'Divide by 2 (false branch)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);

      // Find the function call steps and condition step
      const step1 = result.steps.find(s => s.stepId === 1);
      const condStep = result.steps.find(s => s.stepId === 2 && s.type === StepType.CONDITION);
      const step3 = result.steps.find(s => s.stepId === 3);

      // Step 1: add(10, 20) = 30
      expect(step1).toBeDefined();
      expect(step1!.type).toBe(StepType.FUNCTION_CALL);
      expect(step1!).toHaveProperty('result', 30);

      // Step 2: condition 30 > 25 = true
      expect(condStep).toBeDefined();
      const condResult = condStep as ConditionalResult;
      expect(condResult.evaluatedResult).toBe(true);
      expect(condResult.executedBranch).toBe('onTrue');
      expect(condResult.skippedSteps).toEqual([4]);

      // Step 3: multiply(30, 2) = 60
      expect(step3).toBeDefined();
      expect(step3!.type).toBe(StepType.FUNCTION_CALL);
      expect(step3!).toHaveProperty('result', 60);

      expect(result.finalResult).toBe(60);
    });

    it('should execute plan with condition evaluating to false', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-2',
        userRequest: 'Test condition execution',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add two numbers',
            parameters: {
              a: { type: 'literal', value: 5 },
              b: { type: 'literal', value: 10 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if result > 25',
            condition: 'step1Result > 25',
            onTrue: [3],
            onFalse: [4],
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply by 2 (true branch)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: 'Divide by 2 (false branch)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);

      // Find the function call steps and condition step
      const step1 = result.steps.find(s => s.stepId === 1);
      const condStep = result.steps.find(s => s.stepId === 2 && s.type === StepType.CONDITION);
      const step4 = result.steps.find(s => s.stepId === 4);

      // Step 1: add(5, 10) = 15
      expect(step1).toBeDefined();
      expect(step1!).toHaveProperty('result', 15);

      // Step 2: condition 15 > 25 = false
      expect(condStep).toBeDefined();
      const condResult = condStep as ConditionalResult;
      expect(condResult.evaluatedResult).toBe(false);
      expect(condResult.executedBranch).toBe('onFalse');
      expect(condResult.skippedSteps).toEqual([3]);

      // Step 4: divide(15, 2) = 7.5
      expect(step4).toBeDefined();
      expect(step4!).toHaveProperty('result', 7.5);

      expect(result.finalResult).toBe(7.5);
    });

    it('should handle condition referencing non-existent step gracefully', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-3',
        userRequest: 'Test invalid condition',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 1 },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check invalid reference',
            condition: 'step99Result > 25',
            onTrue: [3],
            onFalse: [],
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 1 },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      // Condition with non-existent step reference should evaluate to false (conservative)
      const result = await executor.execute(plan);

      // Execution succeeds but condition evaluates to false, so branch is skipped
      expect(result.success).toBe(true);
      // The branch step 3 should be skipped because condition is false
      const condStep = result.steps.find(s => s.stepId === 2 && s.type === StepType.CONDITION);
      expect(condStep).toBeDefined();
      const condResult = condStep as import('../types.js').ConditionalResult;
      expect(condResult.evaluatedResult).toBe(false);
      expect(condResult.skippedSteps).toContain(3);
    });

    it('should throw error when onTrue references non-existent step', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-4',
        userRequest: 'Test invalid onTrue',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 1 },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check condition',
            condition: 'step1Result > 0',
            onTrue: [99], // Non-existent step
            onFalse: [],
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      await expect(executor.execute(plan)).rejects.toThrow(
        '条件步骤 2 的 onTrue 引用了不存在的步骤 99'
      );
    });

    it('should handle nested field access in condition', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-5',
        userRequest: 'Test nested field access',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 100 },
              b: { type: 'literal', value: 50 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if result > 100',
            condition: 'step1Result > 100',
            onTrue: [3],
            onFalse: [4],
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply (true)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add (false)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 1 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      // 150 > 100 = true, so execute step 3: 150 * 2 = 300
      const condStep = result.steps.find(s => s.stepId === 2 && s.type === StepType.CONDITION);
      expect(condStep).toBeDefined();
      const condResult = condStep as ConditionalResult;
      expect(condResult.evaluatedResult).toBe(true);
      expect(result.finalResult).toBe(300);
    });
  });

  describe('formatResultForDisplay', () => {
    it('should format execution result with condition steps', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-6',
        userRequest: 'Test display format',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if result > 20',
            condition: 'step1Result > 20',
            onTrue: [3],
            onFalse: [],
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);
      const formatted = executor.formatResultForDisplay(result);

      expect(formatted).toContain('Step 1: add');
      expect(formatted).toContain('[Condition]');
      expect(formatted).toContain('条件: step1Result > 20');
      expect(formatted).toContain('结果: false'); // 15 > 20 = false
      expect(formatted).toContain('执行分支: onFalse');
    });
  });

  describe('edge cases', () => {
    it('should handle condition with onTrue and onFalse both having multiple steps', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-7',
        userRequest: 'Test multiple steps in branches',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 5 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if result > 20',
            condition: 'step1Result > 20',
            onTrue: [3, 4], // Multiple steps in true branch
            onFalse: [5, 6], // Multiple steps in false branch
          },
          {
            stepId: 3,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'First step in true branch',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Second step in true branch',
            parameters: {
              a: { type: 'reference', value: 'step.3.result' },
              b: { type: 'literal', value: 1 },
            },
          },
          {
            stepId: 5,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: 'First step in false branch',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 6,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Second step in false branch',
            parameters: {
              a: { type: 'reference', value: 'step.5.result' },
              b: { type: 'literal', value: 1 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      // 15 > 20 = false, so execute steps 5 and 6
      // Step 5: 15 / 2 = 7.5
      // Step 6: 7.5 + 1 = 8.5
      expect(result.finalResult).toBe(8.5);

      // Verify both branch steps were executed
      const step5 = result.steps.find(s => s.stepId === 5);
      const step6 = result.steps.find(s => s.stepId === 6);
      expect(step5).toBeDefined();
      expect(step6).toBeDefined();
    });

    it('should handle condition without any branch steps', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-8',
        userRequest: 'Test condition without branches',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add numbers',
            parameters: {
              a: { type: 'literal', value: 1 },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check condition',
            condition: 'step1Result > 0',
            onTrue: [],
            onFalse: [],
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.finalResult).toBe(3);
    });

    it('should handle nested conditions - outer true, inner executed', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-9',
        userRequest: 'Test nested conditions',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'subtract',
            description: 'Calculate 10 - 3',
            parameters: {
              a: { type: 'literal', value: 10 },
              b: { type: 'literal', value: 3 },
            },
          },
          // Outer condition: 7 > 5 = true
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if > 5',
            condition: 'step1Result > 5',
            onTrue: [3], // Execute inner condition
            onFalse: [6], // Skip to outer false branch
          },
          // Inner condition: 7 > 2 = true
          {
            stepId: 3,
            type: StepType.CONDITION,
            description: 'Check if > 2',
            condition: 'step1Result > 2',
            onTrue: [4],
            onFalse: [5],
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply by 2 (inner true)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 5,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add 8 (inner false)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 8 },
            },
          },
          {
            stepId: 6,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add 10 (outer false)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 10 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      // 10 - 3 = 7
      // 7 > 5 = true → execute step 3
      // 7 > 2 = true → execute step 4: 7 * 2 = 14
      expect(result.finalResult).toBe(14);

      // Verify inner condition was executed
      const innerCond = result.steps.find(s => s.stepId === 3 && s.type === StepType.CONDITION);
      expect(innerCond).toBeDefined();
      const innerCondResult = innerCond as ConditionalResult;
      expect(innerCondResult.evaluatedResult).toBe(true);
      expect(innerCondResult.executedBranch).toBe('onTrue');

      // Verify outer false branch was skipped
      const step6 = result.steps.find(s => s.stepId === 6);
      expect(step6).toBeUndefined();
    });

    it('should handle nested conditions - outer false, inner skipped', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-10',
        userRequest: 'Test nested conditions - outer false',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: 'Calculate 100 / 5',
            parameters: {
              a: { type: 'literal', value: 100 },
              b: { type: 'literal', value: 5 },
            },
          },
          // Outer condition: 20 > 30 = false
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Check if > 30',
            condition: 'step1Result > 30',
            onTrue: [3], // Skip
            onFalse: [4], // Execute
          },
          // Inner condition (in onTrue branch - should be skipped)
          {
            stepId: 3,
            type: StepType.CONDITION,
            description: 'Inner condition (should skip)',
            condition: 'step1Result > 10',
            onTrue: [5],
            onFalse: [6],
          },
          {
            stepId: 4,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Add 10 (outer false)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 10 },
            },
          },
          {
            stepId: 5,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Multiply (inner true - should skip)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 6,
            type: StepType.FUNCTION_CALL,
            functionName: 'subtract',
            description: 'Subtract (inner false - should skip)',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 5 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      // 100 / 5 = 20
      // 20 > 30 = false → execute step 4: 20 + 10 = 30
      // Steps 3, 5, 6 should be skipped
      expect(result.finalResult).toBe(30);

      // Verify only step 4 was executed from the branches
      const step4 = result.steps.find(s => s.stepId === 4);
      expect(step4).toBeDefined();
      expect(step4!).toHaveProperty('result', 30);

      // Verify inner condition and its branches were skipped
      const innerCond = result.steps.find(s => s.stepId === 3 && s.type === StepType.CONDITION);
      expect(innerCond).toBeUndefined();

      const step5 = result.steps.find(s => s.stepId === 5);
      const step6 = result.steps.find(s => s.stepId === 6);
      expect(step5).toBeUndefined();
      expect(step6).toBeUndefined();
    });

    it('should handle deeply nested conditions (3 levels)', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan-11',
        userRequest: 'Test deeply nested conditions',
        steps: [
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Calculate 5 + 5',
            parameters: {
              a: { type: 'literal', value: 5 },
              b: { type: 'literal', value: 5 },
            },
          },
          // Level 1: 10 > 8 = true
          {
            stepId: 2,
            type: StepType.CONDITION,
            description: 'Level 1: Check > 8',
            condition: 'step1Result > 8',
            onTrue: [3],
            onFalse: [8],
          },
          // Level 2: 10 > 5 = true
          {
            stepId: 3,
            type: StepType.CONDITION,
            description: 'Level 2: Check > 5',
            condition: 'step1Result > 5',
            onTrue: [4],
            onFalse: [6],
          },
          // Level 3: 10 > 3 = true
          {
            stepId: 4,
            type: StepType.CONDITION,
            description: 'Level 3: Check > 3',
            condition: 'step1Result > 3',
            onTrue: [5],
            onFalse: [7], // Step 7 is in level 3's false branch
          },
          {
            stepId: 5,
            type: StepType.FUNCTION_CALL,
            functionName: 'multiply',
            description: 'Final: multiply by 10',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 10 },
            },
          },
          // Fallback steps for false branches
          {
            stepId: 6,
            type: StepType.FUNCTION_CALL,
            functionName: 'add',
            description: 'Level 2 fallback: add 1',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 1 },
            },
          },
          {
            stepId: 7,
            type: StepType.FUNCTION_CALL,
            functionName: 'subtract',
            description: 'Level 3 fallback: subtract 2',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
          {
            stepId: 8,
            type: StepType.FUNCTION_CALL,
            functionName: 'divide',
            description: 'Level 1 fallback: divide by 2',
            parameters: {
              a: { type: 'reference', value: 'step.1.result' },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      // 5 + 5 = 10
      // 10 > 8 = true → level 2
      // 10 > 5 = true → level 3
      // 10 > 3 = true → step 5: 10 * 10 = 100
      expect(result.finalResult).toBe(100);

      // Verify all fallback steps were skipped
      const step6 = result.steps.find(s => s.stepId === 6);
      const step7 = result.steps.find(s => s.stepId === 7);
      const step8 = result.steps.find(s => s.stepId === 8);
      expect(step6).toBeUndefined();
      expect(step7).toBeUndefined();
      expect(step8).toBeUndefined();
    });
  });
});
