import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { planCommand } from '../plan.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import { Executor } from '../../../executor/index.js';
import { MockServiceFactory } from '../../../function-completion/interfaces/MockServiceFactory.js';
import { SessionStorage, PlanRefinementLLMClient } from '../../../services/index.js';
import type { ExecutionPlan } from '../../../planner/types.js';
import type { FunctionDefinition } from '../../../registry/types.js';

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
};

// Mock container
vi.mock('../../../container/cli-container.js', () => ({
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

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts');

// Import after mocks
import container, { MockServiceFactory as MockServiceFactoryToken } from '../../../container/cli-container.js';
import { loadFunctions } from '../../utils.js';
import { ConfigManager } from '../../../config/index.js';
import { LoggerFactory } from '../../../logger/index.js';
import { A2UIService } from '../../../a2ui/A2UIService.js';

describe('plan command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockPlanner: Partial<Planner>;
  let mockExecutor: Partial<Executor>;
  let mockMockServiceFactory: Partial<MockServiceFactory>;
  let mockSessionStorage: Partial<SessionStorage>;
  let mockRefinementLLMClient: Partial<PlanRefinementLLMClient>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let configGetSpy: ReturnType<typeof vi.spyOn>;
  let mockInputFn: ReturnType<typeof vi.fn>;

  const defaultOptions = { functions: './dist/functions/index.js' };

  beforeEach(() => {
    // Set up @inquirer/prompts mock
    mockInputFn = vi.fn().mockResolvedValue('quit');
    vi.doMock('@inquirer/prompts', async () => ({
      input: mockInputFn,
      confirm: vi.fn(),
    }));
    vi.clearAllMocks();
    Object.values(mockA2UIService).forEach(mock => mock.mockReset());

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    vi.mocked(loadFunctions).mockResolvedValue(undefined);

    configGetSpy = vi.spyOn(ConfigManager, 'get').mockReturnValue({
      functionCompletion: { enabled: false, maxRetries: 3 },
    } as any);

    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    vi.spyOn(LoggerFactory, 'create').mockReturnValue(mockLogger as any);
    vi.spyOn(LoggerFactory, 'createFromEnv').mockReturnValue(mockLogger as any);

    mockFunctionProvider = { list: vi.fn(), register: vi.fn() };
    mockStorage = { savePlan: vi.fn(), getPlanMocksDir: vi.fn().mockReturnValue('.data/plans/plan-xxx/mocks') };
    mockPlanner = { plan: vi.fn(), formatPlanForDisplay: vi.fn() };
    mockExecutor = { execute: vi.fn(), formatResultForDisplay: vi.fn() };
    mockMockServiceFactory = { createOrchestrator: vi.fn() };
    mockSessionStorage = { saveSession: vi.fn() };
    mockRefinementLLMClient = { refine: vi.fn() };

    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) return mockFunctionProvider as T;
      if (token === Storage) return mockStorage as T;
      if (token === Planner) return mockPlanner as T;
      if (token === Executor) return mockExecutor as T;
      if (token === MockServiceFactoryToken) return mockMockServiceFactory as T;
      if (token === SessionStorage) return mockSessionStorage as T;
      if (token === PlanRefinementLLMClient) return mockRefinementLLMClient as T;
      if (token === A2UIService) return mockA2UIService as T;
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('no functions loaded', () => {
    it('should return early when no functions are registered', async () => {
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('没有找到已注册的函数'), 'warning');
      expect(mockPlanner.plan).not.toHaveBeenCalled();
    });
  });

  describe('planning failure', () => {
    it('should exit with code 1 when planning fails', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'LLM API error' });

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('规划失败'), 'error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('incomplete plan', () => {
    it('should exit with code 1 for incomplete plan without auto-complete', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const incompletePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '查询专利',
        steps: [],
        status: 'incomplete',
        createdAt: new Date().toISOString(),
        missingFunctions: [{ name: 'queryPatent', description: '查询专利', suggestedParameters: [], suggestedReturns: { type: 'object', description: '' } }],
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: incompletePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('查询专利', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('计划不完整'), 'warning');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('executable plan without interactive mode', () => {
    it('should display execute command for executable plan', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockStorage.savePlan).toHaveBeenCalled();
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('计划生成成功'), 'success');
      expect(mockA2UIService.text).toHaveBeenCalledWith(expect.stringContaining('npx fn-orchestrator execute'), 'subheading');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should display mock warning when plan uses mocks', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '查询专利',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
        metadata: {
          usesMocks: true,
          mockFunctions: [{ name: 'queryPatent', version: '1.0.0', filePath: 'mocks/queryPatent-v1.js', generatedAt: new Date().toISOString() }],
        },
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('查询专利', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('MOCK 数据'), 'warning');
    });
  });

  describe('function loading display', () => {
    it('should display all function sources correctly', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
        { name: 'mcpTool', description: 'MCP', parameters: [], returns: { type: 'string', description: '' }, implementation: () => {}, source: 'mcp-server' },
        { name: 'customFunc', description: 'Custom', parameters: [], returns: { type: 'string', description: '' }, implementation: () => {}, source: 'custom' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('Test', defaultOptions);

      expect(mockA2UIService.caption).toHaveBeenCalledWith(expect.stringContaining('已加载 3 个函数'));
    });
  });

  describe('auto-complete enabled', () => {
    it('should use PlannerWithMockSupport when auto-complete is enabled', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      configGetSpy.mockReturnValue({ functionCompletion: { enabled: true, maxRetries: 3 } } as any);

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockMockServiceFactory.createOrchestrator).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors during planning', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unexpected error'));

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'), 'error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('plan formatting', () => {
    it('should format plan with function call steps correctly', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const executablePlan: ExecutionPlan = {
        id: 'plan-12345678',
        userRequest: '计算 1 + 2',
        steps: [{
          stepId: 1,
          type: 'function_call',
          functionName: 'add',
          parameters: { a: { type: 'literal', value: 1 }, b: { type: 'literal', value: 2 } },
        }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 详细计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      expect(mockStorage.savePlan).toHaveBeenCalledWith(executablePlan);
      expect(mockA2UIService.text).toHaveBeenCalledWith('📋 详细计划内容');
    });

    it('should override plan ID with generated UUID-based ID', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'add', description: '加法', parameters: [], returns: { type: 'number', description: '' }, implementation: () => {}, source: 'local' },
      ];

      const originalPlanId = 'original-id';
      const executablePlan: ExecutionPlan = {
        id: originalPlanId,
        userRequest: '计算 1 + 2',
        steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);
      (mockPlanner.plan as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, plan: executablePlan });
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('📋 计划内容');

      await planCommand('计算 1 + 2', defaultOptions);

      const savedPlan = (mockStorage.savePlan as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedPlan.id).toMatch(/^plan-[a-f0-9]{8}$/);
      expect(savedPlan.id).not.toBe(originalPlanId);
    });
  });
});
