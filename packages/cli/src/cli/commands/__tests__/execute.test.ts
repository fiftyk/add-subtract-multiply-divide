import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeCommand } from '../execute.js';
import { FunctionProvider } from '@fn-orchestrator/core/function-provider/interfaces/FunctionProvider.js';
import { Storage } from '@fn-orchestrator/core/storage/interfaces/Storage.js';
import { Executor } from '@fn-orchestrator/core/executor';
import { Planner } from '@fn-orchestrator/core/planner/interfaces/IPlanner.js';
import { ExecutionSessionManager } from '@fn-orchestrator/core/executor/session/index.js';
import type { ExecutionPlan } from '@fn-orchestrator/core/planner/types.js';
import type { ExecutionResult } from '@fn-orchestrator/core/executor/types.js';
import type { FunctionDefinition } from '@fn-orchestrator/core/registry/types.js';
import type { ExecutionSession } from '@fn-orchestrator/core/executor/session/types.js';

// Shared mock reference for executor mocks
const sharedMockExecutor = {
  execute: vi.fn(),
  formatResultForDisplay: vi.fn(),
};

// Mock ExecutionSessionManager
const mockSessionManager = {
  createSession: vi.fn(),
  executeSession: vi.fn(),
  retrySession: vi.fn(),
  resumeSession: vi.fn(),
};

// Mock A2UIService
const mockA2UIService = {
  startSurface: vi.fn(),
  endSurface: vi.fn(),
  text: vi.fn(),
  heading: vi.fn(),
  caption: vi.fn(),
  badge: vi.fn(),
  code: vi.fn(),
  divider: vi.fn(),
  progress: vi.fn(),
  list: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
};

// Mock A2UIRenderer
const mockA2UIRenderer = {
  begin: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  end: vi.fn(),
  onUserAction: vi.fn(),
  requestInput: vi.fn(),
};

// Mock container
vi.mock('../../../container/cli-container.js', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock loadFunctions
vi.mock('../../utils.js', () => ({
  loadFunctions: vi.fn(),
}));

// Mock @inquirer/prompts - use vi.doMock in beforeEach to avoid hoisting issues
vi.mock('@inquirer/prompts');

// Mock executors - use shared mock reference
vi.mock('@fn-orchestrator/core/executor/implementations/ExecutorImpl.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@fn-orchestrator/core/executor/implementations/ExecutorImpl.js')>();
  return {
    ...original,
    ExecutorImpl: vi.fn().mockImplementation(() => sharedMockExecutor),
  };
});

vi.mock('@fn-orchestrator/core/executor/implementations/ConditionalExecutor.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@fn-orchestrator/core/executor/implementations/ConditionalExecutor.js')>();
  return {
    ...original,
    ConditionalExecutor: vi.fn().mockImplementation(() => sharedMockExecutor),
  };
});

// Import after mocks
import container from '../../../container/cli-container.js';
import { loadFunctions } from '../../utils.js';
import { A2UIService } from '@fn-orchestrator/core/a2ui/A2UIService.js';
import { A2UIRenderer } from '@fn-orchestrator/core/a2ui/A2UIRenderer.js';

describe('execute command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockExecutor: Partial<Executor>;
  let mockPlanner: Partial<Planner>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockConfirmFn: ReturnType<typeof vi.fn>;

  const defaultOptions = { functions: './dist/functions/index.js', yes: false };

  // Helper function to create mock session
  function createMockSession(plan: ExecutionPlan, sessionId = 'session-test-123'): ExecutionSession {
    return {
      id: sessionId,
      planId: plan.id,
      basePlanId: plan.id,
      plan,
      status: 'pending',
      currentStepId: 0,
      stepResults: [],
      context: {},
      pendingInput: null,
      retryCount: 0,
      platform: 'cli',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up inquirer.prompts mock
    mockConfirmFn = vi.fn().mockResolvedValue(true);
    vi.doMock('@inquirer/prompts', async () => ({
      confirm: mockConfirmFn,
      input: vi.fn(),
    }));

    // Reset shared mock executor functions
    sharedMockExecutor.execute.mockReset();
    sharedMockExecutor.formatResultForDisplay.mockReset();

    // Reset session manager mocks
    mockSessionManager.createSession.mockReset();
    mockSessionManager.executeSession.mockReset();
    mockSessionManager.retrySession.mockReset();
    mockSessionManager.resumeSession.mockReset();

    // Reset A2UIService mocks
    Object.values(mockA2UIService).forEach(mock => mock.mockReset());

    // Mock process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    // Mock console.error (still used for error handling)
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
      if (token === A2UIService) {
        return mockA2UIService as T;
      }
      if (token === A2UIRenderer) {
        return mockA2UIRenderer as T;
      }
      if (token === ExecutionSessionManager) {
        return mockSessionManager as T;
      }
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('plan not found', () => {
    it('should return when plan does not exist', async () => {
      vi.mocked(mockStorage.loadPlan).mockResolvedValue(undefined);

      await executeCommand('non-existent-plan', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('找不到计划'),
        'error'
      );
    });
  });

  describe('non-executable plan', () => {
    it('should show warning for incomplete plan', async () => {
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

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('不可执行'),
        'warning'
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

      const mockSession = createMockSession(executablePlan, 'session-mocks');

      const mockFunctions: FunctionDefinition[] = [
        { name: 'customFunc', description: 'Custom function', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'local' },
      ];

      const mockPlanMocks: FunctionDefinition[] = [
        { name: 'customFunc', description: 'Mock function', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'mock' },
      ];

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      vi.mocked(mockStorage.loadPlanMocks).mockResolvedValue(mockPlanMocks);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-mocks', { functions: './dist/functions/index.js', yes: true });

      expect(mockStorage.loadPlanMocks).toHaveBeenCalledWith('plan-mocks');
      expect(mockFunctionProvider.register).toHaveBeenCalled();
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

      const mockSession = createMockSession(executablePlan);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      // Should not prompt for confirmation
      expect(mockConfirmFn).not.toHaveBeenCalled();
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
      mockConfirmFn.mockResolvedValue(false);

      await executeCommand('plan-123', defaultOptions);

      expect(mockA2UIService.caption).toHaveBeenCalledWith(
        expect.stringContaining('已取消执行')
      );
      // SessionManager should not be called
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
      expect(mockSessionManager.executeSession).not.toHaveBeenCalled();
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

      const mockSession = createMockSession(executablePlan);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(executablePlan, 'cli');
      expect(mockSessionManager.executeSession).toHaveBeenCalledWith(mockSession.id);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('执行成功'),
        'success'
      );
      expect(mockA2UIService.caption).toHaveBeenCalledWith(`Session ID: ${mockSession.id}`);
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

      const mockSession = createMockSession(executablePlan);

      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
        { name: 'subtract', description: '减法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('3');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-123', { functions: './dist/functions/index.js', yes: true });

      expect(mockA2UIService.heading).toHaveBeenCalledWith(
        expect.stringContaining('已加载的函数')
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

      const mockSession = createMockSession(executablePlan, 'session-fail');

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(failedResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('Error: Division by zero');

      await executeCommand('plan-fail', { functions: './dist/functions/index.js', yes: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('执行失败'),
        'error'
      );
      expect(mockA2UIService.text).toHaveBeenCalledWith(
        expect.stringContaining('sessions retry'),
        'subheading'
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors during execution and exit with code 1', async () => {
      vi.mocked(mockStorage.loadPlan).mockRejectedValue(
        new Error('Failed to load plan')
      );

      await executeCommand('plan-error', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load plan'),
        'error'
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

      const mockResult: ExecutionResult = {
        planId: 'plan-mocks',
        steps: [],
        finalResult: 'done',
        success: true,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      const mockSession = createMockSession(planWithMocks);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithMocks);
      vi.mocked(mockStorage.loadPlanMocks).mockRejectedValue(
        new Error('Failed to load mocks')
      );
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');

      await executeCommand('plan-mocks', { functions: './dist/functions/index.js', yes: true });

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        expect.stringContaining('无法加载'),
        'warning'
      );
      // Should continue execution despite mock loading error
      expect(mockSessionManager.executeSession).toHaveBeenCalled();
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

      const mockSession = createMockSession(planWithoutMetadata);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithoutMetadata);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
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

      const mockSession = createMockSession(planWithEmptyMocks);

      // loadPlanMocks is still called when usesMocks is true, even if mockFunctions is empty
      vi.mocked(mockStorage.loadPlanMocks).mockResolvedValue([]);

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(planWithEmptyMocks);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('done');
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

      const mockSession = createMockSession(executablePlan, 'session-display');

      vi.mocked(mockStorage.loadPlan).mockResolvedValue(executablePlan);
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.executeSession.mockResolvedValue(mockResult);
      (mockExecutor.formatResultForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('最终结果: 42\n步骤数: 2');
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await executeCommand('plan-display', { functions: './dist/functions/index.js', yes: true });

      expect(mockExecutor.formatResultForDisplay).toHaveBeenCalledWith(mockResult);
      expect(mockA2UIService.text).toHaveBeenCalledWith('最终结果: 42\n步骤数: 2');
    });
  });
});
