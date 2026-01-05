import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listCommand } from '../list.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import type { FunctionDefinition } from '../../../registry/types.js';
import type { ExecutionPlan } from '../../../planner/types.js';

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
}));

// Mock loadFunctions
vi.mock('../../utils.js', () => ({
  loadFunctions: vi.fn(),
}));

// Import after mocks
import container from '../../../container/cli-container.js';
import { loadFunctions } from '../../utils.js';
import { A2UIService } from '../../../a2ui/A2UIService.js';

describe('list command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockPlanner: Partial<Planner>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockA2UIService).forEach(mock => mock.mockReset());

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    vi.mocked(loadFunctions).mockResolvedValue(undefined);

    mockFunctionProvider = {
      list: vi.fn(),
      register: vi.fn(),
    };

    mockStorage = {
      listPlans: vi.fn(),
      loadPlan: vi.fn(),
    };

    mockPlanner = {
      formatPlanForDisplay: vi.fn(),
    };

    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) return mockFunctionProvider as T;
      if (token === Storage) return mockStorage as T;
      if (token === Planner) return mockPlanner as T;
      if (token === A2UIService) return mockA2UIService as T;
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('functions command', () => {
    const options = { functions: './dist/functions/index.js' };

    it('should list local functions', async () => {
      const mockFunctions: FunctionDefinition[] = [{
        name: 'add',
        description: '加法运算',
        scenario: '两个数相加',
        parameters: [
          { name: 'a', type: 'number', description: '第一个数' },
          { name: 'b', type: 'number', description: '第二个数' },
        ],
        returns: { type: 'number', description: '两数之和' },
        implementation: (a: number, b: number) => a + b,
        source: 'local',
      }];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(loadFunctions).toHaveBeenCalledWith(mockFunctionProvider, options.functions);
      expect(mockA2UIService.heading).toHaveBeenCalledWith(expect.stringContaining('本地函数'));
    });

    it('should list remote functions', async () => {
      const mockFunctions: FunctionDefinition[] = [{
        name: 'remoteTool',
        description: 'Remote tool description',
        parameters: [{ name: 'input', type: 'string', description: 'Input data' }],
        returns: { type: 'string', description: 'Output data' },
        implementation: () => {},
        source: 'mcp-server-1',
      }];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.heading).toHaveBeenCalledWith(expect.stringContaining('远程函数'));
    });

    it('should list both local and remote functions', async () => {
      const mockFunctions: FunctionDefinition[] = [
        { name: 'localFunc', description: 'Local', parameters: [], returns: { type: 'void', description: '' }, implementation: () => {}, source: 'local' },
        { name: 'remoteFunc', description: 'Remote', parameters: [], returns: { type: 'void', description: '' }, implementation: () => {}, source: 'remote' },
      ];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.heading).toHaveBeenCalledWith(expect.stringContaining('1 个本地函数, 1 个远程函数'));
    });

    it('should handle no functions found - exit with code 1', async () => {
      vi.mocked(mockFunctionProvider.list!).mockResolvedValue([]);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('没有找到已注册的函数'), 'warning');
    });

    it('should handle errors - exit with code 1', async () => {
      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to list functions'));

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('Failed to list functions'), 'error');
    });

    it('should display function with scenario', async () => {
      const mockFunctions: FunctionDefinition[] = [{
        name: 'testFunc',
        description: 'Test function',
        scenario: 'Use this when testing',
        parameters: [],
        returns: { type: 'void', description: 'No return' },
        implementation: () => {},
        source: 'local',
      }];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.caption).toHaveBeenCalledWith(expect.stringContaining('Use this when testing'));
    });

    it('should display remote function without parameters', async () => {
      const mockFunctions: FunctionDefinition[] = [{
        name: 'noParamFunc',
        description: 'Function without parameters',
        parameters: [],
        returns: { type: 'string', description: 'Result' },
        implementation: () => {},
        source: 'remote',
      }];

      (mockFunctionProvider.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunctions);

      await listCommand.functions(options);

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.caption).toHaveBeenCalledWith(expect.stringContaining('(无参数)'));
    });
  });

  describe('plans command', () => {
    it('should list all plans', async () => {
      const mockPlans: ExecutionPlan[] = [
        { id: 'plan-1', userRequest: '计算 1 + 2', steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }], status: 'executable', createdAt: '2024-01-01' },
        { id: 'plan-2', userRequest: '查询专利', steps: [], status: 'incomplete', createdAt: '2024-01-02' },
      ];

      (mockStorage.listPlans as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlans);

      await listCommand.plans();

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.heading).toHaveBeenCalledWith(expect.stringContaining('执行计划列表'));
    });

    it('should display executable status icon', async () => {
      const mockPlans: ExecutionPlan[] = [
        { id: 'plan-exec', userRequest: 'Test', steps: [], status: 'executable', createdAt: '2024-01-01' },
      ];

      (mockStorage.listPlans as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlans);

      await listCommand.plans();

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.text).toHaveBeenCalledWith(expect.stringContaining('✅'), 'subheading');
    });

    it('should display incomplete status icon', async () => {
      const mockPlans: ExecutionPlan[] = [
        { id: 'plan-incomplete', userRequest: 'Test', steps: [], status: 'incomplete', createdAt: '2024-01-01' },
      ];

      (mockStorage.listPlans as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlans);

      await listCommand.plans();

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.text).toHaveBeenCalledWith(expect.stringContaining('⚠️'), 'subheading');
    });

    it('should handle no plans - exit with code 0', async () => {
      vi.mocked(mockStorage.listPlans!).mockResolvedValue([]);

      await listCommand.plans();

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('没有保存的执行计划'), 'warning');
    });

    it('should handle errors - exit with code 1', async () => {
      (mockStorage.listPlans as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to list plans'));

      await listCommand.plans();

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('Failed to list plans'), 'error');
    });
  });

  describe('showPlan command', () => {
    it('should show plan details', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-123',
        userRequest: '计算 1 + 2',
        steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: '2024-01-01',
      };

      (mockStorage.loadPlan as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlan);
      (mockPlanner.formatPlanForDisplay as ReturnType<typeof vi.fn>).mockReturnValue('Formatted plan output');

      await listCommand.showPlan('plan-123');

      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockStorage.loadPlan).toHaveBeenCalledWith('plan-123');
      expect(mockA2UIService.text).toHaveBeenCalledWith('Formatted plan output');
    });

    it('should handle plan not found - exit with code 1', async () => {
      (mockStorage.loadPlan as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await listCommand.showPlan('non-existent');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('找不到计划'), 'error');
    });

    it('should handle errors - exit with code 1', async () => {
      (mockStorage.loadPlan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to load plan'));

      await listCommand.showPlan('plan-123');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('Failed to load plan'), 'error');
    });
  });
});
