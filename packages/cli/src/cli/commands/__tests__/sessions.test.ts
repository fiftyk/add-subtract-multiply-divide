import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  listCommand,
  showCommand,
  retryCommand,
  deleteCommand,
  statsCommand,
} from '../sessions.js';
import type { ExecutionSession, ExecutionStats } from '@fn-orchestrator/core/executor/session/types.js';
import type { ExecutionPlan } from '@fn-orchestrator/core/planner/types.js';
import type { ExecutionResult } from '@fn-orchestrator/core/executor/types.js';

// Mock A2UIService
const mockA2UIService = {
  startSurface: vi.fn(),
  endSurface: vi.fn(),
  text: vi.fn(),
  heading: vi.fn(),
  caption: vi.fn(),
  badge: vi.fn(),
};

// Mock ExecutionSessionStorage
const mockSessionStorage = {
  listSessions: vi.fn(),
  loadSession: vi.fn(),
  deleteSession: vi.fn(),
  getExecutionStats: vi.fn(),
};

// Mock ExecutionSessionManager
const mockSessionManager = {
  retrySession: vi.fn(),
  executeSession: vi.fn(),
};

// Mock Executor
const mockExecutor = {
  formatResultForDisplay: vi.fn(),
};

// Mock Planner
const mockPlanner = {
  formatPlanForDisplay: vi.fn(),
};

// Mock container
vi.mock('../../../container/cli-container.js', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Import after mocks
import container from '../../../container/cli-container.js';
import { A2UIService } from '@fn-orchestrator/core/a2ui/A2UIService.js';
import { ExecutionSessionStorage, ExecutionSessionManager } from '@fn-orchestrator/core/executor/session/index.js';
import { Executor } from '@fn-orchestrator/core/executor';
import { Planner } from '@fn-orchestrator/core/planner';

describe('sessions command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  // Helper function to create mock session
  function createMockSession(overrides?: Partial<ExecutionSession>): ExecutionSession {
    const mockPlan: ExecutionPlan = {
      id: 'plan-123',
      userRequest: 'Test request',
      steps: [],
      status: 'executable',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    return {
      id: 'session-abc',
      planId: 'plan-123',
      basePlanId: 'plan-123',
      plan: mockPlan,
      status: 'completed',
      currentStepId: 0,
      stepResults: [],
      context: {},
      pendingInput: null,
      retryCount: 0,
      platform: 'cli',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:01.000Z',
      completedAt: '2024-01-01T00:00:02.000Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      return undefined as never;
    }) as any);

    // Setup container mock
    vi.mocked(container.get).mockImplementation(<T,>(token: any): T => {
      if (token === A2UIService) {
        return mockA2UIService as T;
      }
      if (token === ExecutionSessionStorage) {
        return mockSessionStorage as T;
      }
      if (token === ExecutionSessionManager) {
        return mockSessionManager as T;
      }
      if (token === Executor) {
        return mockExecutor as T;
      }
      if (token === Planner) {
        return mockPlanner as T;
      }
      throw new Error(`Unexpected token: ${token?.toString()}`);
    });

    // Reset mocks
    Object.values(mockA2UIService).forEach(mock => mock.mockReset());
    Object.values(mockSessionStorage).forEach(mock => mock.mockReset());
    Object.values(mockSessionManager).forEach(mock => mock.mockReset());
    mockExecutor.formatResultForDisplay.mockReset();
    mockPlanner.formatPlanForDisplay.mockReset();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  // ============================================
  // listCommand Tests
  // ============================================
  describe('listCommand', () => {
    it('should list all sessions', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', basePlanId: 'plan-123' }),
        createMockSession({ id: 'session-2', basePlanId: 'plan-456' }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({});

      expect(mockA2UIService.startSurface).toHaveBeenCalledWith('sessions-list');
      expect(mockA2UIService.heading).toHaveBeenCalledWith('📋 执行会话列表');
      expect(mockSessionStorage.listSessions).toHaveBeenCalledWith({});
      expect(mockA2UIService.caption).toHaveBeenCalledWith('找到 2 个会话:\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should filter sessions by planId', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', planId: 'plan-123' }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({ plan: 'plan-123' });

      expect(mockSessionStorage.listSessions).toHaveBeenCalledWith({
        planId: 'plan-123',
      });
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should filter sessions by status', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', status: 'completed' }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({ status: 'completed' });

      expect(mockSessionStorage.listSessions).toHaveBeenCalledWith({
        status: 'completed',
      });
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should filter by both planId and status', async () => {
      const sessions = [
        createMockSession({ id: 'session-1' }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({ plan: 'plan-123', status: 'completed' });

      expect(mockSessionStorage.listSessions).toHaveBeenCalledWith({
        planId: 'plan-123',
        status: 'completed',
      });
    });

    it('should handle no sessions found', async () => {
      mockSessionStorage.listSessions.mockResolvedValue([]);

      await listCommand({});

      expect(mockA2UIService.caption).toHaveBeenCalledWith('没有找到匹配的会话');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should group sessions by plan', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', basePlanId: 'plan-123' }),
        createMockSession({ id: 'session-2', basePlanId: 'plan-123' }),
        createMockSession({ id: 'session-3', basePlanId: 'plan-456' }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({});

      // Should display plan headers
      expect(mockA2UIService.text).toHaveBeenCalledWith('Plan: plan-123', 'subheading');
      expect(mockA2UIService.text).toHaveBeenCalledWith('Plan: plan-456', 'subheading');
    });

    it('should display session with running status', async () => {
      const sessions = [
        createMockSession({
          id: 'session-running',
          status: 'running',
          completedAt: undefined,
        }),
      ];

      mockSessionStorage.listSessions.mockResolvedValue(sessions);

      await listCommand({});

      // Should show 'running' for duration
      expect(mockA2UIService.caption).toHaveBeenCalledWith(
        expect.stringContaining('running')
      );
    });

    it('should handle errors', async () => {
      mockSessionStorage.listSessions.mockRejectedValue(new Error('Storage error'));

      await listCommand({});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Storage error',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================
  // showCommand Tests
  // ============================================
  describe('showCommand', () => {
    it('should display session details', async () => {
      const session = createMockSession({
        id: 'session-abc',
        planId: 'plan-123',
        basePlanId: 'plan-123',
        status: 'completed',
      });

      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockPlanner.formatPlanForDisplay.mockReturnValue('Plan details');
      mockExecutor.formatResultForDisplay.mockReturnValue('Result details');

      await showCommand('session-abc');

      expect(mockA2UIService.heading).toHaveBeenCalledWith('📄 会话详情: session-abc');
      expect(mockSessionStorage.loadSession).toHaveBeenCalledWith('session-abc');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  Session ID: session-abc');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  Plan ID: plan-123');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should display versioned plan info', async () => {
      const session = createMockSession({
        planId: 'plan-123-v2',
        basePlanId: 'plan-123',
        planVersion: 2,
      });

      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockPlanner.formatPlanForDisplay.mockReturnValue('Plan details');

      await showCommand('session-abc');

      expect(mockA2UIService.caption).toHaveBeenCalledWith('  Plan Version: v2');
    });

    it('should display retry information', async () => {
      const session = createMockSession({
        parentSessionId: 'session-parent',
        retryCount: 2,
      });

      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockPlanner.formatPlanForDisplay.mockReturnValue('Plan details');

      await showCommand('session-abc');

      expect(mockA2UIService.text).toHaveBeenCalledWith('重试信息:', 'subheading');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  父会话 ID: session-parent');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  重试次数: 2');
    });

    it('should display execution result if present', async () => {
      const mockResult: ExecutionResult = {
        planId: 'plan-123',
        success: true,
        steps: [],
        finalResult: 42,
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      const session = createMockSession({
        result: mockResult,
      });

      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockPlanner.formatPlanForDisplay.mockReturnValue('Plan details');
      mockExecutor.formatResultForDisplay.mockReturnValue('Result: 42');

      await showCommand('session-abc');

      expect(mockA2UIService.text).toHaveBeenCalledWith('执行结果:', 'subheading');
      expect(mockExecutor.formatResultForDisplay).toHaveBeenCalledWith(mockResult);
    });

    it('should show retry hint for failed sessions', async () => {
      const session = createMockSession({
        id: 'session-failed',
        status: 'failed',
      });

      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockPlanner.formatPlanForDisplay.mockReturnValue('Plan details');

      await showCommand('session-failed');

      expect(mockA2UIService.text).toHaveBeenCalledWith(
        '💡 提示: 使用 "npx fn-orchestrator sessions retry session-failed" 重试',
        'subheading'
      );
    });

    it('should handle session not found', async () => {
      mockSessionStorage.loadSession.mockResolvedValue(undefined);

      await showCommand('non-existent');

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 找不到会话: non-existent',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle errors', async () => {
      mockSessionStorage.loadSession.mockRejectedValue(new Error('Load error'));

      await showCommand('session-abc');

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Load error',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================
  // retryCommand Tests
  // ============================================
  describe('retryCommand', () => {
    it('should retry session successfully', async () => {
      const retrySession = createMockSession({
        id: 'session-retry',
        retryCount: 1,
      });

      const successResult: ExecutionResult = {
        planId: 'plan-123',
        success: true,
        steps: [],
        finalResult: 'success',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      mockSessionManager.retrySession.mockResolvedValue(retrySession);
      mockSessionManager.executeSession.mockResolvedValue(successResult);
      mockExecutor.formatResultForDisplay.mockReturnValue('Success');

      await retryCommand('session-failed', {});

      expect(mockA2UIService.heading).toHaveBeenCalledWith('🔄 重试会话: session-failed');
      expect(mockSessionManager.retrySession).toHaveBeenCalledWith('session-failed', undefined);
      expect(mockA2UIService.badge).toHaveBeenCalledWith('✅ 重试会话已创建', 'success');
      expect(mockSessionManager.executeSession).toHaveBeenCalledWith('session-retry');
      expect(mockA2UIService.badge).toHaveBeenCalledWith('✅ 执行成功!', 'success');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should retry from specific step', async () => {
      const retrySession = createMockSession({
        id: 'session-retry',
        currentStepId: 2,
      });

      const successResult: ExecutionResult = {
        planId: 'plan-123',
        success: true,
        steps: [],
        finalResult: 'success',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      mockSessionManager.retrySession.mockResolvedValue(retrySession);
      mockSessionManager.executeSession.mockResolvedValue(successResult);
      mockExecutor.formatResultForDisplay.mockReturnValue('Success');

      await retryCommand('session-failed', { fromStep: 2 });

      expect(mockSessionManager.retrySession).toHaveBeenCalledWith('session-failed', 2);
      expect(mockA2UIService.caption).toHaveBeenCalledWith('从步骤 2 开始');
    });

    it('should handle retry execution failure', async () => {
      const retrySession = createMockSession({
        id: 'session-retry',
      });

      const failedResult: ExecutionResult = {
        planId: 'plan-123',
        success: false,
        steps: [],
        error: 'Execution failed',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      };

      mockSessionManager.retrySession.mockResolvedValue(retrySession);
      mockSessionManager.executeSession.mockResolvedValue(failedResult);
      mockExecutor.formatResultForDisplay.mockReturnValue('Failed');

      await retryCommand('session-failed', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith('❌ 执行失败', 'error');
      expect(mockA2UIService.text).toHaveBeenCalledWith(
        expect.stringContaining('sessions retry'),
        'subheading'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle retry creation errors', async () => {
      mockSessionManager.retrySession.mockRejectedValue(
        new Error('Cannot retry completed session')
      );

      await retryCommand('session-abc', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Cannot retry completed session',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle execution errors', async () => {
      const retrySession = createMockSession({ id: 'session-retry' });
      mockSessionManager.retrySession.mockResolvedValue(retrySession);
      mockSessionManager.executeSession.mockRejectedValue(new Error('Execution error'));

      await retryCommand('session-failed', {});

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Execution error',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================
  // deleteCommand Tests
  // ============================================
  describe('deleteCommand', () => {
    it('should delete session successfully', async () => {
      const session = createMockSession({ id: 'session-abc' });
      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockSessionStorage.deleteSession.mockResolvedValue(undefined);

      await deleteCommand('session-abc');

      expect(mockA2UIService.heading).toHaveBeenCalledWith('🗑️  删除会话: session-abc');
      expect(mockSessionStorage.loadSession).toHaveBeenCalledWith('session-abc');
      expect(mockSessionStorage.deleteSession).toHaveBeenCalledWith('session-abc');
      expect(mockA2UIService.badge).toHaveBeenCalledWith('✅ 会话已删除', 'success');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle session not found', async () => {
      mockSessionStorage.loadSession.mockResolvedValue(undefined);
      // Note: deleteSession will still be called because mocked process.exit doesn't stop execution
      mockSessionStorage.deleteSession.mockResolvedValue(undefined);

      await deleteCommand('non-existent');

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 找不到会话: non-existent',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle deletion errors', async () => {
      const session = createMockSession({ id: 'session-abc' });
      mockSessionStorage.loadSession.mockResolvedValue(session);
      mockSessionStorage.deleteSession.mockRejectedValue(new Error('Delete error'));

      await deleteCommand('session-abc');

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Delete error',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================
  // statsCommand Tests
  // ============================================
  describe('statsCommand', () => {
    it('should display execution statistics', async () => {
      const stats: ExecutionStats = {
        totalExecutions: 10,
        successCount: 8,
        failureCount: 2,
        averageDuration: 5000, // 5 seconds
      };

      mockSessionStorage.getExecutionStats.mockResolvedValue(stats);

      await statsCommand('plan-123');

      expect(mockA2UIService.heading).toHaveBeenCalledWith('📊 执行统计: plan-123');
      expect(mockSessionStorage.getExecutionStats).toHaveBeenCalledWith('plan-123');
      expect(mockA2UIService.text).toHaveBeenCalledWith('统计信息:', 'subheading');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  总执行次数: 10');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  成功次数: 8');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  失败次数: 2');
      expect(mockA2UIService.caption).toHaveBeenCalledWith('  成功率: 80.0%');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should display average duration', async () => {
      const stats: ExecutionStats = {
        totalExecutions: 5,
        successCount: 5,
        failureCount: 0,
        averageDuration: 125000, // 125 seconds = 2m 5s
      };

      mockSessionStorage.getExecutionStats.mockResolvedValue(stats);

      await statsCommand('plan-123');

      expect(mockA2UIService.caption).toHaveBeenCalledWith(
        expect.stringContaining('平均执行时长')
      );
    });

    it('should handle no executions', async () => {
      const stats: ExecutionStats = {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
      };

      mockSessionStorage.getExecutionStats.mockResolvedValue(stats);

      await statsCommand('plan-123');

      expect(mockA2UIService.caption).toHaveBeenCalledWith('该计划还没有执行记录');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should calculate 100% success rate', async () => {
      const stats: ExecutionStats = {
        totalExecutions: 5,
        successCount: 5,
        failureCount: 0,
        averageDuration: 1000,
      };

      mockSessionStorage.getExecutionStats.mockResolvedValue(stats);

      await statsCommand('plan-123');

      expect(mockA2UIService.caption).toHaveBeenCalledWith('  成功率: 100.0%');
    });

    it('should calculate 0% success rate', async () => {
      const stats: ExecutionStats = {
        totalExecutions: 3,
        successCount: 0,
        failureCount: 3,
        averageDuration: 500,
      };

      mockSessionStorage.getExecutionStats.mockResolvedValue(stats);

      await statsCommand('plan-123');

      expect(mockA2UIService.caption).toHaveBeenCalledWith('  成功率: 0.0%');
    });

    it('should handle errors', async () => {
      mockSessionStorage.getExecutionStats.mockRejectedValue(new Error('Stats error'));

      await statsCommand('plan-123');

      expect(mockA2UIService.badge).toHaveBeenCalledWith(
        '❌ 错误: Stats error',
        'error'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
