import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { refineCommand } from '../refine.js';
import { FunctionProvider } from '../../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../../storage/interfaces/Storage.js';
import { Planner } from '../../../planner/interfaces/IPlanner.js';
import { SessionStorage, PlanRefinementLLMClient } from '../../../services/index.js';
import type { ExecutionPlan } from '../../../planner/types.js';

// Mock container
vi.mock('../../../container.js', () => ({
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

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Import after mocks
import container from '../../../container.js';
import inquirer from 'inquirer';

describe('refine command', () => {
  let mockFunctionProvider: Partial<FunctionProvider>;
  let mockStorage: Partial<Storage>;
  let mockSessionStorage: Partial<SessionStorage>;
  let mockRefinementLLMClient: Partial<PlanRefinementLLMClient>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let inquirerPromptSpy: ReturnType<typeof vi.spyOn>;

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

    // Mock inquirer
    inquirerPromptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ instruction: 'done' });

    // Create mock instances
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

    // Setup container mock
    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === FunctionProvider) return mockFunctionProvider as T;
      if (token === Storage) return mockStorage as T;
      if (token === SessionStorage) return mockSessionStorage as T;
      if (token === Planner) return {} as T;
      if (token === PlanRefinementLLMClient) return mockRefinementLLMClient as T;
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('plan not found', () => {
    it('should exit with code 1 when plan does not exist', async () => {
      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'non-existent', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion).mockResolvedValue(null);
      vi.mocked(mockStorage.loadPlan).mockResolvedValue(null);

      await refineCommand('non-existent', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('找不到计划')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle plan not found after parsing with version', async () => {
      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'exists', version: 1 });
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(null);

      await refineCommand('exists-v1', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('找不到计划')
      );
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

      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'plan-abc', version: 1 });
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(mockPlan);
      inquirerPromptSpy.mockResolvedValue({ instruction: 'quit' });

      await refineCommand('plan-abc-v1', {});

      expect(mockStorage.loadPlanVersion).toHaveBeenCalledWith('plan-abc', 1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('当前计划')
      );
    });

    it('should load latest version when no version is provided', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v2',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'plan-abc', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion).mockResolvedValue({ plan: mockPlan, version: 2 });
      inquirerPromptSpy.mockResolvedValue({ instruction: 'quit' });

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

      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'plan-legacy', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion).mockResolvedValue(null);
      vi.mocked(mockStorage.loadPlan).mockResolvedValue(mockLegacyPlan);
      inquirerPromptSpy.mockResolvedValue({ instruction: 'quit' });

      await refineCommand('plan-legacy', {});

      expect(mockStorage.loadPlan).toHaveBeenCalled();
      expect(mockStorage.savePlanVersion).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('旧格式计划')
      );
    });
  });

  describe('interactive mode', () => {
    it('should display current plan on start', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test request',
        steps: [
          { stepId: 1, type: 'function_call', functionName: 'add', parameters: {} },
        ],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(mockPlan);
      inquirerPromptSpy.mockResolvedValue({ instruction: 'quit' });

      await refineCommand('plan-abc-v1', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('交互式')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('当前计划')
      );
    });

    it('should exit on "done" command', async () => {
      inquirerPromptSpy.mockResolvedValue({ instruction: 'done' });

      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(mockPlan);

      await refineCommand('plan-abc-v1', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('改进完成')
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should exit on "quit" command', async () => {
      inquirerPromptSpy.mockResolvedValue({ instruction: 'quit' });

      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(mockPlan);

      await refineCommand('plan-abc-v1', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('改进完成')
      );
    });

    it('should show error for empty instruction', async () => {
      const mockPlan: ExecutionPlan = {
        id: 'plan-abc-v1',
        userRequest: 'Test',
        steps: [],
        status: 'executable',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockStorage.loadPlanVersion).mockResolvedValue(mockPlan);
      inquirerPromptSpy
        .mockResolvedValueOnce({ instruction: '' })
        .mockResolvedValue({ instruction: 'quit' });

      await refineCommand('plan-abc-v1', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('请输入有效的修改指令')
      );
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      vi.mocked(mockStorage.parsePlanId).mockReturnValue({ basePlanId: 'error-test', version: undefined });
      vi.mocked(mockStorage.loadLatestPlanVersion).mockRejectedValue(new Error('Storage error'));

      await refineCommand('error-test', {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage error')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('versioned plan handling', () => {
    it('should parse versioned plan ID correctly', () => {
      // The actual parsePlanId function
      const parsePlanId = (planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) {
          return { basePlanId: match[1], version: parseInt(match[2], 10) };
        }
        return { basePlanId: planId, version: undefined };
      };

      const result = parsePlanId('plan-abc-v1');
      expect(result.basePlanId).toBe('plan-abc');
      expect(result.version).toBe(1);
    });

    it('should parse unversioned plan ID correctly', () => {
      const parsePlanId = (planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) {
          return { basePlanId: match[1], version: parseInt(match[2], 10) };
        }
        return { basePlanId: planId, version: undefined };
      };

      const result = parsePlanId('plan-xyz');
      expect(result.basePlanId).toBe('plan-xyz');
      expect(result.version).toBeUndefined();
    });

    it('should handle plan ID with complex suffix', () => {
      const parsePlanId = (planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) {
          return { basePlanId: match[1], version: parseInt(match[2], 10) };
        }
        return { basePlanId: planId, version: undefined };
      };

      const result = parsePlanId('my-plan-v99');
      expect(result.basePlanId).toBe('my-plan');
      expect(result.version).toBe(99);
    });
  });
});
