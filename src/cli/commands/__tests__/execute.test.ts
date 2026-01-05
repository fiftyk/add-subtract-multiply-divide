import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeCommand } from '../execute.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Executor } from '../../../executor/index.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import type { ExecutionPlan } from '../../../planner/types.js';
import type { ExecutionResult } from '../../../executor/types.js';
import type { FunctionDefinition } from '../../../registry/types.js';

// Shared mock reference for executor mocks
const sharedMockExecutor = {
  execute: vi.fn(),
  formatResultForDisplay: vi.fn(),
};

// Mock container
vi.mock('../../../container.js', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock loadFunctions
vi.mock('../../utils.js', () => ({
  loadFunctions: vi.fn(),
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock executors - use shared mock reference
vi.mock('../../../executor/implementations/ExecutorImpl.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../executor/implementations/ExecutorImpl.js')>();
  return {
    ...original,
    ExecutorImpl: vi.fn().mockImplementation(() => sharedMockExecutor),
  };
});

vi.mock('../../../executor/implementations/ConditionalExecutor.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../executor/implementations/ConditionalExecutor.js')>();
  return {
    ...original,
    ConditionalExecutor: vi.fn().mockImplementation(() => sharedMockExecutor),
  };
});

// Import after mocks
import container from '../../../container.js';
import { loadFunctions } from '../../utils.js';
import inquirer from 'inquirer';

describe('execute command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockExecutor: Partial<Executor>;
  let mockPlanner: Partial<Planner>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let inquirerPromptSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions = { functions: './dist/functions/index.js', yes: false };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset shared mock executor functions
    sharedMockExecutor.execute.mockReset();
    sharedMockExecutor.formatResultForDisplay.mockReset();

    // Mock process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock loadFunctions
    vi.mocked(loadFunctions).mockResolvedValue(undefined);

    // Create mock instances
    mockFunctionProvider = {
      list: vi.fn(),
      register: vi.fn(),
    };

    mockStorage = {
      loadPlan: vi.fn(),
      loadPlanMocks: vi.fn(),
      saveExecution: vi.fn(),
    };

    // Use shared mock executor
    mockExecutor = sharedMockExecutor;

    mockPlanner = {
      formatPlanForDisplay: vi.fn(),
    };

    // Mock inquirer.prompt
    inquirerPromptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ confirm: true });

    // Setup container mock
    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) {
        return mockFunctionProvider as T;
      }
      if (token === Storage) {
        return mockStorage as T;
      }
      if (token === Executor) {
        return mockExecutor as T;
      }
      if (token === Planner) {
        return mockPlanner as T;
      }
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('plan not found', () => {
    it('should return when plan does not exist', async () => {
      vi.mocked(mockStorage.loadPlan).mockResolvedValue(undefined);

      await executeCommand('non-existent-plan', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('找不到计划: non-existent-plan')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('list plans')
      );
    });
  });

  describe('non-executable plan', () => {
    it('should show missing functions for incomplete plan', async () => {
      const incompletePlan: ExecutionPlan = {
        id: 'plan-incomplete',
        userRequest: '查询专利',
        steps: [],
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        missingFunctions: [{ name: 'queryPatent', description: '查询专利' }],
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(incompletePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await executeCommand('plan-incomplete', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('计划不可执行')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('queryPatent')
      );
    });

    it('should load and display plan-specific mock functions', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-mocks',
        userRequest: 'Test with mocks',
        steps: [],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {
          usesMocks: true,
          mockFunctions: [
            { name: 'customFunc', version: '1.0.0' },
          ],
        },
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-mocks',
        steps: [],
        finalResult: 'done',
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      const mockFunctions: FunctionDefinition[] = [
        { name: 'customFunc', description: 'Custom function', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'local' },
      ];

      const mockPlanMocks: FunctionDefinition[] = [
        { name: 'customFunc', description: 'Mock function', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'mock' },
      ];

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      vi.mocked(mockStorage.loadPlanMocks).mockResolvedValue(mockPlanMocks);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-mocks', { functions: './dist/functions/index.js', yes: true });

      expect(mockStorage.loadPlanMocks).toHaveBeenCalledWith('plan-mocks');
      expect(mockFunctionProvider.register).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 个 plan-specific mock 函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mock 函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('customFunc (mock)')
      );
    });
  });

  describe('plan display and confirmation', () => {
    it('should skip confirmation when yes option is true', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: '计算 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
          },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-123',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
            result: 3,
            success: true,
            executedAt: '2024-01-01T00:00:01.000Z',
          },
        ],
        finalResult: 3,
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      // Should not prompt for confirmation
      expect(inquirerPromptSpy).not.toHaveBeenCalled();
    });

    it('should cancel execution when user declines', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: '计算 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
          },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      inquirerPromptSpy.mockResolvedValue({ confirm: false });

      await executeCommand('plan-123', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('已取消执行')
      );
      // Executor should not be called
      expect(mockExecutor.execute).not.toHaveBeenCalled();
    });
  });

  describe('successful execution', () => {
    it('should execute plan successfully and exit with code 0', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: '计算 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
          },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-123',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
            result: 3,
            success: true,
            executedAt: '2024-01-01T00:00:01.000Z',
          },
        ],
        finalResult: 3,
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      expect(mockExecutor.execute).toHaveBeenCalledWith(executablePlan);
      expect(mockStorage.saveExecution).toHaveBeenCalledWith(mockResult);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('执行成功')
      );
    });

    it('should display loaded functions', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: '计算 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {},
          },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-123',
        steps: [],
        finalResult: 3,
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
        { name: 'subtract', description: '减法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('已加载的函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('总共 2 个函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('add')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('subtract')
      );
    });
  });

  describe('failed execution', () => {
    it('should exit with code 1 when execution fails', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-fail',
        userRequest: 'Divide by zero',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'divide',
            parameters: {},
          },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const failedResult: ExecutionResult = {
        planId: 'plan-fail',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'divide',
            parameters: { divisor: 0 },
            result: undefined,
            success: false,
            error: 'Division by zero',
            executedAt: '2024-01-01T00:00:01.000Z',
          },
        ],
        finalResult: undefined,
        success: false,
        error: 'Division by zero',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(failedResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('Error: Division by zero');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-fail');

      await executeCommand('plan-fail', { functions: './dist/functions/index.js', yes: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('执行失败')
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors during execution and exit with code 1', async () => {
      vi.mocked(mockStorage.loadPlan).mockRejectedValue(
        new Error('Failed to load plan')
      );

      await executeCommand('plan-error', defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load plan')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle mock loading errors gracefully', async () => {
      const planWithMocks: ExecutionPlan = {
        id: 'plan-mocks',
        userRequest: 'Test with mocks',
        steps: [],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {
          usesMocks: true,
          mockFunctions: [
            { name: 'mockFunc', version: '1.0.0' },
          ],
        },
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithMocks);
      vi.mocked(mockStorage.loadPlanMocks).mockRejectedValue(
        new Error('Failed to load mocks')
      );
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await executeCommand('plan-mocks', { functions: './dist/functions/index.js', yes: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('无法加载 plan-specific mocks')
      );
      // Should continue execution despite mock loading error
      expect(mockExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle plan with no metadata', async () => {
      const planWithoutMetadata: ExecutionPlan = {
        id: 'plan-simple',
        userRequest: 'Simple calculation',
        steps: [],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-simple',
        steps: [],
        finalResult: 'done',
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithoutMetadata);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-simple', { functions: './dist/functions/index.js', yes: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle empty mockFunctions array in metadata', async () => {
      const planWithEmptyMocks: ExecutionPlan = {
        id: 'plan-empty-mocks',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {
          usesMocks: true,
          mockFunctions: [],
        },
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-empty-mocks',
        steps: [],
        finalResult: 'done',
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      // loadPlanMocks is still called when usesMocks is true, even if mockFunctions is empty
      vi.mocked(mockStorage.loadPlanMocks).mockResolvedValue([]);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithEmptyMocks);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-123');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-empty-mocks', { functions: './dist/functions/index.js', yes: true });

      expect(mockStorage.loadPlanMocks).toHaveBeenCalledWith('plan-empty-mocks');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should display execution result correctly', async () => {
      const executablePlan: ExecutionPlan = {
        id: 'plan-display',
        userRequest: 'Complex calculation',
        steps: [
          { stepId: 1, type: 'function_call', functionName: 'add', parameters: {} },
          { stepId: 2, type: 'function_call', functionName: 'multiply', parameters: {} },
        ],
        status: 'executable',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult: ExecutionResult = {
        planId: 'plan-display',
        steps: [],
        finalResult: { total: 42, steps: 2 },
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('最终结果: 42\n步骤数: 2');
      vi.mocked(mockStorage.saveExecution).mockResolvedValue('exec-456');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-display', { functions: './dist/functions/index.js', yes: true });

      expect(mockExecutor.formatResultForDisplay).toHaveBeenCalledWith(mockResult);
      expect(consoleLogSpy).toHaveBeenCalledWith('最终结果: 42\n步骤数: 2');
    });
  });
});
