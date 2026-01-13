import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { refineCommand } from '../refine.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import { PlanRefinementSessionStorage, PlanRefinementLLMClient } from '../../../services/index.js';
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

// Mock ConfigManager
vi.mock('../../../config/index.js', () => ({
  ConfigManager: {
    get: vi.fn().mockReturnValue({}),
  },
}));

// Mock @inquirer/prompts - create mocks in factory
// Store mock functions in module-level variables for test control
var inquirerPromptInput: ReturnType<typeof vi.fn>;
var inquirerPromptConfirm: ReturnType<typeof vi.fn>;

vi.mock('@inquirer/prompts', async () => {
  // Create mock functions if not already created
  if (typeof inquirerPromptInput === 'undefined') {
    inquirerPromptInput = vi.fn();
  }
  if (typeof inquirerPromptConfirm === 'undefined') {
    inquirerPromptConfirm = vi.fn();
  }
  return {
    input: inquirerPromptInput,
    confirm: inquirerPromptConfirm,
  };
});

// Import after mocks
import container from '../../../container/cli-container.js';
import { A2UIService } from '../../../a2ui/A2UIService.js';

describe('refine command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockSessionStorage: Partial<PlanRefinementSessionStorage>;
  let mockRefinementLLMClient: Partial<PlanRefinementLLMClient>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockA2UIService).forEach(mock => mock.mockReset());

    // Configure inquirer prompts mocks - modify existing mocks, don't reassign
    if (inquirerPromptInput) inquirerPromptInput.mockReset().mockResolvedValue('done');
    if (inquirerPromptConfirm) inquirerPromptConfirm.mockReset().mockResolvedValue(true);

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    mockFunctionProvider = { list: vi.fn() };
    mockSessionStorage = { saveSession: vi.fn() };
    mockRefinementLLMClient = { refine: vi.fn() };

    mockStorage = {
      loadPlan: vi.fn(),
      loadPlanVersion: vi.fn(),
      loadLatestPlanVersion: vi.fn(),
      savePlanVersion: vi.fn(),
      parsePlanId: vi.fn().mockReturnValue({ basePlanId: 'plan-abc', version: 1 }),
    };

    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) return mockFunctionProvider as T;
      if (token === Storage) return mockStorage as T;
      if (token === PlanRefinementSessionStorage) return mockSessionStorage as T;
      if (token === Planner) return {} as T;
      if (token === PlanRefinementLLMClient) return mockRefinementLLMClient as T;
      if (token === A2UIService) return mockA2UIService as T;
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('plan not found', () => {
    it('should exit with code 1 when plan does not exist', async () => {
      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'non-existent', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion!).mockResolvedValue(null);
      vi.mocked(mockStorage.loadPlan!).mockResolvedValue(null);

      await refineCommand('non-existent', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('找不到计划'), 'error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle plan not found after parsing with version', async () => {
      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'exists', version: 1 });
      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(null);

      await refineCommand('exists-v1', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('找不到计划'), 'error');
    });
  });

  describe('versioned plan loading', () => {
    it('should load specific version when version is provided', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'plan-abc', version: 1 });
      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(mockPlan);
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('quit');

      await refineCommand('plan-abc-v1', {});

      expect(mockStorage.loadPlanVersion).toHaveBeenCalledWith('plan-abc', 1);
      expect(mockA2UIService.text).toHaveBeenCalledWith(expect.stringContaining('当前计划'), 'subheading');
    });

    it('should load latest version when no version is provided', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v2',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'plan-abc', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion!).mockResolvedValue({ plan: mockPlan, version: 2 });
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('quit');

      await refineCommand('plan-abc', {});

      expect(mockStorage.loadLatestPlanVersion).toHaveBeenCalledWith('plan-abc');
    });
  });

  describe('legacy plan migration', () => {
    it('should migrate legacy plan to versioned format', async () => {
      const mockLegacyPlan: ExecutionPlan = {
        id: 'plan-legacy',
        userRequest: 'Legacy plan',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'plan-legacy', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion!).mockResolvedValue(null);
      vi.mocked(mockStorage.loadPlan!).mockResolvedValue(mockLegacyPlan);
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('quit');

      await refineCommand('plan-legacy', {});

      expect(mockStorage.loadPlan).toHaveBeenCalled();
      expect(mockStorage.savePlanVersion).toHaveBeenCalled();
      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('旧格式计划'), 'info');
    });
  });

  describe('interactive mode', () => {
    it('should display current plan on start', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test request',
        steps: [{ stepId: 1, type: 'function_call', functionName: 'add', parameters: {} }],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(mockPlan);
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('quit');

      await refineCommand('plan-abc-v1', {});

      expect(mockA2UIService.heading).toHaveBeenCalledWith(expect.stringContaining('交互式'));
    });

    it('should exit on "done" command', async () => {
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('done');

      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(mockPlan);

      await refineCommand('plan-abc-v1', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('改进完成'), 'success');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should exit on "quit" command', async () => {
      if (inquirerPromptInput) inquirerPromptInput.mockResolvedValue('quit');

      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(mockPlan);

      await refineCommand('plan-abc-v1', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('改进完成'), 'success');
    });

    it('should show error for empty instruction', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.loadPlanVersion!).mockResolvedValue(mockPlan);
      if (inquirerPromptInput) inquirerPromptInput
        .mockResolvedValueOnce('')
        .mockResolvedValue('quit');

      await refineCommand('plan-abc-v1', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('请输入有效的修改指令'), 'warning');
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      vi.mocked(mockStorage.parsePlanId!).mockReturnValue({ basePlanId: 'error-test', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion!).mockRejectedValue(new Error('Storage error'));

      await refineCommand('error-test', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(expect.stringContaining('Storage error'), 'error');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('versioned plan handling', () => {
    it('should parse versioned plan ID correctly', () => {
      const parsePlanId = (planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) return { basePlanId: match[1], version: parseInt(match[2], 10) };
        return { basePlanId: planId, version: undefined };
      };

      const result = parsePlanId('plan-abc-v1');
      expect(result.basePlanId).toBe('plan-abc');
      expect(result.version).toBe(1);
    });

    it('should parse unversioned plan ID correctly', () => {
      const parsePlanId = (planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) return { basePlanId: match[1], version: parseInt(match[2], 10) };
        return { basePlanId: planId, version: undefined };
      };

      const result = parsePlanId('plan-xyz');
      expect(result.basePlanId).toBe('plan-xyz');
      expect(result.version).toBeUndefined();
    });
  });
});
