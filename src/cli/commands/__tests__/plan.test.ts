import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { planCommand } from '../plan.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import { Executor } from '../../../executor/index.js';
import { MockServiceFactory } from '../../../function-completion/interfaces/MockServiceFactory.js';
import { SessionStorage, PlanRefinementLLMClient } from '../../../services/index.js';
import type { ExecutionPlan, PlanResult } from '../../../planner/types.js';
import type { FunctionDefinition } from '../../../registry/types.js';

// Mock container
vi.mock('../../../container.js', () => ({
  default: {
    get: vi.fn(),
  },
  MockServiceFactory: Symbol('MockServiceFactory'),
}));

// Mock loadFunctions
vi.mock('../../utils.js', () => ({
  loadFunctions: vi.fn(),
}));

// Mock ConfigManager
vi.mock('../../../config/index.js', () => ({
  ConfigManager: {
    get: vi.fn(),
  },
}));

// Mock LoggerFactory
vi.mock('../../../logger/index.js', () => ({
  LoggerFactory: {
    create: vi.fn(),
    createFromEnv: vi.fn(),
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Import after mocks
import container, { MockServiceFactory as MockServiceFactoryToken } from '../../../container.js';
import { loadFunctions } from '../../utils.js';
import { ConfigManager } from '../../../config/index.js';
import { LoggerFactory } from '../../../logger/index.js';
import inquirer from 'inquirer';

describe('plan command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockPlanner: Partial<Planner>;
  let mockExecutor: Partial<Executor>;
  let mockMockServiceFactory: Partial<MockServiceFactory>;
  let mockSessionStorage: Partial<SessionStorage>;
  let mockRefinementLLMClient: Partial<PlanRefinementLLMClient>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let inquirerPromptSpy: ReturnType<typeof vi.spyOn>;
  let configGetSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions = { functions: './dist/functions/index.js' };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock loadFunctions
    vi.mocked(loadFunctions).mockResolvedValue(undefined);

    // Mock ConfigManager
    configGetSpy = vi.spyOn(ConfigManager, 'get').mockReturnValue({
      functionCompletion: { enabled: false, maxRetries: 3 },
    } as any);

    // Mock LoggerFactory
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.spyOn(LoggerFactory, 'create').mockReturnValue(mockLogger as any);
    vi.spyOn(LoggerFactory, 'createFromEnv').mockReturnValue(mockLogger as any);

    // Mock inquirer
    inquirerPromptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ input: 'quit' });

    // Create mock instances
    mockFunctionProvider = {
      list: vi.fn(),
      register: vi.fn(),
    };

    mockStorage = {
      savePlan: vi.fn(),
      getPlanMocksDir: vi.fn().mockReturnValue('.data/plans/plan-xxx/mocks'),
    };

    mockPlanner = {
      plan: vi.fn(),
      formatPlanForDisplay: vi.fn(),
    };

    mockExecutor = {
      execute: vi.fn(),
      formatResultForDisplay: vi.fn(),
    };

    mockMockServiceFactory = {
      createOrchestrator: vi.fn(),
    };

    mockSessionStorage = {
      saveSession: vi.fn(),
    };

    mockRefinementLLMClient = {
      refine: vi.fn(),
    };

    // Setup container mock
    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) {
        return mockFunctionProvider as T;
      }
      if (token === Storage) {
        return mockStorage as T;
      }
      if (token === Planner) {
        return mockPlanner as T;
      }
      if (token === Executor) {
        return mockExecutor as T;
      }
      if (token === MockServiceFactoryToken) {
        return mockMockServiceFactory as T;
      }
      if (token === SessionStorage) {
        return mockSessionStorage as T;
      }
      if (token === PlanRefinementLLMClient) {
        return mockRefinementLLMClient as T;
      }
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('no functions loaded', () => {
    it('should return early when no functions are registered', async () => {
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await planCommand('计算 1 + 2', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('没有找到已注册的函数')
      );
      expect(mockPlanner.plan).not.toHaveBeenCalled();
    });
  });

  describe('planning failure', () => {
    it('should exit with code 1 when planning fails', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'LLM API error',
      });

      await planCommand('计算 1 + 2', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('规划失败')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('incomplete plan', () => {
    it('should exit with code 1 for incomplete plan without auto-complete', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const incompletePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '查询专利',
        steps: [],
        status: 'incomplete',
        createdAt: new Date().toISOString(),
        missingFunctions: [{ name: 'queryPatent', description: '查询专利' }],
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: incompletePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('查询专利', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('计划不完整')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('缺少 1 个函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('--auto-complete')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('executable plan without interactive mode', () => {
    it('should display execute command for executable plan', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [
          { stepId: 1, type: 'function_call', functionName: 'add', parameters: {} },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockStorage.savePlan).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('计划生成成功')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('npx fn-orchestrator execute')
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should display mock warning when plan uses mocks', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '查询专利',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
        metadata: {
          usesMocks: true,
          mockFunctions: [
            { name: 'queryPatent', version: '1.0.0', filePath: 'mocks/queryPatent-v1.js', generatedAt: new Date().toISOString() },
          ],
        },
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('查询专利', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('使用了 MOCK 数据')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('queryPatent')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('编辑 ')
      );
    });
  });

  describe('function loading display', () => {
    it('should display all function sources correctly', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
        { name: 'mcpTool', description: 'MCP tool', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'mcp-server' },
        { name: 'customFunc', description: 'Custom', parameters: [], returns: { type: 'string' }, implementation: () => {}, source: 'custom' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('Test', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('已加载 3 个函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('本地函数')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP 工具')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mock 函数')
      );
    });

    it('should only show local functions when only local exist', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
        { name: 'subtract', description: '减法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('Test', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('本地函数')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('MCP')
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Mock')
      );
    });
  });

  describe('auto-complete enabled', () => {
    it('should use PlannerWithMockSupport when auto-complete is enabled', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [
          { stepId: 1, type: 'function_call', functionName: 'add', parameters: {} },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      configGetSpy.mockReturnValue({
        functionCompletion: { enabled: true, maxRetries: 3 },
      } as any);

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockMockServiceFactory.createOrchestrator).toHaveBeenCalled();
    });

    it('should generate executable plan after mock generation', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
        { name: 'queryPatent', description: '查询专利', parameters: [], returns: { type: 'object' }, implementation: () => {}, source: 'mock' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '查询并计算',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
        metadata: {
          usesMocks: true,
          mockFunctions: [
            { name: 'queryPatent', version: '1.0.0', filePath: 'mocks/queryPatent-v1.js', generatedAt: new Date().toISOString() },
          ],
        },
      };

      configGetSpy.mockReturnValue({
        functionCompletion: { enabled: true, maxRetries: 3 },
      } as any);

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('查询并计算', defaultOptions);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('使用了 MOCK 数据')
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors during planning', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Unexpected error')
      );

      await planCommand('计算 1 + 2', defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('plan formatting', () => {
    it('should format plan with function call steps correctly', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [
          {
            stepId: 1,
            type: 'function_call',
            functionName: 'add',
            parameters: {
              a: { type: 'literal', value: 1 },
              b: { type: 'literal', value: 2 },
            },
          },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 详细计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockStorage.savePlan).toHaveBeenCalledWith(executablePlan);
      expect(consoleLogSpy).toHaveBeenCalledWith('📋 详细计划内容');
    });

    it('should override plan ID with generated UUID-based ID', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number' }, implementation: () => {}, source: 'local' },
      ];

      const originalPlanId = 'original-id';
      const executablePlan: ExecutionPlan = {
        id: originalPlanId,
        userRequest: '计算 1 + 2',
        steps: [
          { stepId: 1, type: 'function_call', functionName: 'add', parameters: {} },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        plan: executablePlan,
      });
      mockPlanner.formatPlanForDisplay.mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      // Verify savePlan was called with modified plan ID (plan-xxxxxxxx)
      const savedPlan = (mockStorage.savePlan as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedPlan.id).toMatch(/^plan-[a-f0-9]{8}$/);
      expect(savedPlan.id).not.toBe(originalPlanId);
    });
  });
});
