import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionSessionManagerImpl } from '../ExecutionSessionManagerImpl.js';
import type { ExecutionSessionStorage } from '../../interfaces/ExecutionSessionStorage.js';
import type { ExecutionSession } from '../../types.js';
import type { ExecutionPlan } from '../../../../planner/types.js';
import type { ExecutionResult } from '../../../types.js';
import type { Executor } from '../../../interfaces/Executor.js';
import type { Storage } from '../../../../storage/interfaces/Storage.js';
import { StepType } from '../../../../planner/types.js';

describe('ExecutionSessionManagerImpl', () => {
  let manager: ExecutionSessionManagerImpl;
  let mockSessionStorage: ExecutionSessionStorage;
  let mockExecutor: Executor;
  let mockStorage: Storage;

  beforeEach(() => {
    // Mock ExecutionSessionStorage
    mockSessionStorage = {
      saveSession: vi.fn(),
      loadSession: vi.fn(),
      updateSession: vi.fn(),
      deleteSession: vi.fn(),
      listSessions: vi.fn(),
      listSessionsByPlan: vi.fn(),
      listSessionsByBasePlan: vi.fn(),
      getRecentSessions: vi.fn(),
      getExecutionStats: vi.fn(),
    };

    // Mock Executor
    mockExecutor = {
      execute: vi.fn(),
      formatResultForDisplay: vi.fn(),
      getPlanRulesForLLM: vi.fn(),
    };

    // Mock Storage
    mockStorage = {
      parsePlanId: vi.fn((planId: string) => {
        const match = planId.match(/^(.+)-v(\d+)$/);
        if (match) {
          return { basePlanId: match[1], version: parseInt(match[2], 10) };
        }
        return { basePlanId: planId, version: undefined };
      }),
    } as any;

    manager = new ExecutionSessionManagerImpl(
      mockSessionStorage,
      mockExecutor,
      mockStorage
    );
  });

  // ============================================
  // Helper Functions
  // ============================================

  function createMockPlan(planId: string = 'plan-test'): ExecutionPlan {
    return {
      id: planId,
      userRequest: '测试需求',
      steps: [
        {
          stepId: 0,
          type: StepType.FUNCTION_CALL,
          functionName: 'testFunction',
          parameters: {},
        },
      ],
      status: 'executable',
    };
  }

  function createMockSession(
    overrides?: Partial<ExecutionSession>
  ): ExecutionSession {
    return {
      id: 'session-test-001',
      planId: 'plan-test',
      basePlanId: 'plan-test',
      planVersion: undefined,
      plan: createMockPlan('plan-test'),
      status: 'pending',
      currentStepId: 0,
      stepResults: [],
      context: {},
      pendingInput: null,
      retryCount: 0,
      platform: 'cli',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function createMockResult(
    success: boolean = true
  ): ExecutionResult {
    return {
      planId: 'plan-test',
      success,
      steps: [],
      finalResult: success ? 'ok' : undefined,
      error: success ? undefined : 'Test error',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:00:01.000Z',
    };
  }

  // ============================================
  // createSession
  // ============================================

  describe('createSession', () => {
    it('should create a session with plan ID parsing', async () => {
      const plan = createMockPlan('plan-abc');
      const savedSession = vi.fn();
      mockSessionStorage.saveSession = savedSession;

      const session = await manager.createSession(plan, 'cli');

      expect(session.id).toMatch(/^session-[a-z0-9]{8}$/);
      expect(session.planId).toBe('plan-abc');
      expect(session.basePlanId).toBe('plan-abc');
      expect(session.planVersion).toBeUndefined();
      expect(session.platform).toBe('cli');
      expect(session.status).toBe('pending');
      expect(session.retryCount).toBe(0);
      expect(savedSession).toHaveBeenCalledWith(session);
    });

    it('should parse versioned plan ID', async () => {
      const plan = createMockPlan('plan-abc-v2');
      const savedSession = vi.fn();
      mockSessionStorage.saveSession = savedSession;

      const session = await manager.createSession(plan, 'web');

      expect(session.planId).toBe('plan-abc-v2');
      expect(session.basePlanId).toBe('plan-abc');
      expect(session.planVersion).toBe(2);
      expect(session.platform).toBe('web');
    });

    it('should initialize session with correct default values', async () => {
      const plan = createMockPlan();
      mockSessionStorage.saveSession = vi.fn();

      const session = await manager.createSession(plan, 'cli');

      expect(session.currentStepId).toBe(0);
      expect(session.stepResults).toEqual([]);
      expect(session.context).toEqual({});
      expect(session.pendingInput).toBeNull();
      expect(session.retryCount).toBe(0);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });
  });

  // ============================================
  // executeSession
  // ============================================

  describe('executeSession', () => {
    it('should execute a session successfully', async () => {
      const session = createMockSession();
      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(session);
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      const result = await manager.executeSession('session-test-001');

      expect(result).toEqual(successResult);
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-test-001',
        expect.objectContaining({ status: 'running' })
      );
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-test-001',
        expect.objectContaining({
          status: 'completed',
          result: successResult,
          completedAt: expect.any(String),
        })
      );
    });

    it('should handle execution failure', async () => {
      const session = createMockSession();
      const failureResult = createMockResult(false);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(session);
      vi.mocked(mockExecutor.execute).mockResolvedValue(failureResult);
      mockSessionStorage.updateSession = vi.fn();

      const result = await manager.executeSession('session-test-001');

      expect(result.success).toBe(false);
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-test-001',
        expect.objectContaining({
          status: 'failed',
          result: failureResult,
        })
      );
    });

    it('should handle executor throwing error', async () => {
      const session = createMockSession();
      const error = new Error('Execution error');

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(session);
      vi.mocked(mockExecutor.execute).mockRejectedValue(error);
      mockSessionStorage.updateSession = vi.fn();

      const result = await manager.executeSession('session-test-001');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution error');
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-test-001',
        expect.objectContaining({
          status: 'failed',
          result: expect.objectContaining({
            success: false,
            error: 'Execution error',
          }),
        })
      );
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(undefined);

      await expect(
        manager.executeSession('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  // ============================================
  // retrySession
  // ============================================

  describe('retrySession', () => {
    it('should create a retry session', async () => {
      const failedSession = createMockSession({
        id: 'session-failed',
        status: 'failed',
        retryCount: 0,
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(failedSession);
      mockSessionStorage.saveSession = vi.fn();

      const retrySession = await manager.retrySession('session-failed');

      expect(retrySession.id).toMatch(/^session-[a-z0-9]{8}$/);
      expect(retrySession.id).not.toBe('session-failed');
      expect(retrySession.parentSessionId).toBe('session-failed');
      expect(retrySession.retryCount).toBe(1);
      expect(retrySession.status).toBe('pending');
      expect(retrySession.currentStepId).toBe(0);
      expect(mockSessionStorage.saveSession).toHaveBeenCalledWith(retrySession);
    });

    it('should copy context when starting from specific step', async () => {
      const failedSession = createMockSession({
        id: 'session-failed',
        status: 'failed',
        currentStepId: 2,
        stepResults: [
          {
            stepId: 0,
            type: StepType.FUNCTION_CALL,
            functionName: 'test1',
            parameters: {},
            result: 'result1',
            success: true,
            executedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            stepId: 1,
            type: StepType.FUNCTION_CALL,
            functionName: 'test2',
            parameters: {},
            result: 'result2',
            success: true,
            executedAt: '2024-01-01T00:00:01.000Z',
          },
        ] as any,
        context: { key1: 'value1', key2: 'value2' },
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(failedSession);
      mockSessionStorage.saveSession = vi.fn();

      const retrySession = await manager.retrySession('session-failed', 1);

      expect(retrySession.currentStepId).toBe(1);
      expect(retrySession.stepResults).toHaveLength(1);
      expect(retrySession.stepResults[0].stepId).toBe(0);
      expect(retrySession.context).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(undefined);

      await expect(
        manager.retrySession('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should throw error if session is not failed', async () => {
      const completedSession = createMockSession({
        status: 'completed',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(completedSession);

      await expect(
        manager.retrySession('session-test-001')
      ).rejects.toThrow('Cannot retry session with status: completed');
    });

    it('should increment retry count for multiple retries', async () => {
      const failedSession = createMockSession({
        id: 'session-failed',
        status: 'failed',
        retryCount: 2,
        parentSessionId: 'session-original',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(failedSession);
      mockSessionStorage.saveSession = vi.fn();

      const retrySession = await manager.retrySession('session-failed');

      expect(retrySession.retryCount).toBe(3);
    });
  });

  // ============================================
  // resumeSession
  // ============================================

  describe('resumeSession', () => {
    it('should resume a session waiting for input', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
        context: { existingKey: 'existingValue' },
      });

      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession)
        .mockResolvedValueOnce(waitingSession)
        .mockResolvedValueOnce({
          ...waitingSession,
          pendingInput: null,
          context: { existingKey: 'existingValue', userInput: 'test' },
        });

      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      const result = await manager.resumeSession('session-waiting', {
        userInput: 'test',
      });

      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-waiting',
        expect.objectContaining({
          pendingInput: null,
          context: expect.objectContaining({
            existingKey: 'existingValue',
            userInput: 'test',
          }),
        })
      );

      expect(result).toEqual(successResult);
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(undefined);

      await expect(
        manager.resumeSession('non-existent', {})
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should throw error if session is not waiting for input', async () => {
      const runningSession = createMockSession({
        status: 'running',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(runningSession);

      await expect(
        manager.resumeSession('session-test-001', {})
      ).rejects.toThrow('Cannot resume session with status: running');
    });

    it('should create user input step result with correct values', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        currentStepId: 1,
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
      });

      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(waitingSession);
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      await manager.resumeSession('session-waiting', {
        companyName: '华为',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      // Verify the updateSession call for processing input
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-waiting',
        expect.objectContaining({
          pendingInput: null,
          currentStepId: 2, // Incremented from 1 to 2
          status: 'running',
          stepResults: expect.arrayContaining([
            expect.objectContaining({
              stepId: 1,
              type: StepType.USER_INPUT,
              values: {
                companyName: '华为',
                startDate: '2024-01-01',
                endDate: '2024-12-31',
              },
              success: true,
              executedAt: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should start execution from correct step after user input', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        currentStepId: 1, // User input step is at index 1
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
        stepResults: [
          {
            stepId: 0,
            type: StepType.FUNCTION_CALL,
            functionName: 'firstFunction',
            parameters: {},
            result: 'result1',
            success: true,
            executedAt: '2024-01-01T00:00:00.000Z',
          },
        ] as any,
      });

      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(waitingSession);
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      await manager.resumeSession('session-waiting', { userInput: 'test' });

      // Verify executor was called with startFromStep = 2 (after user input step)
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          startFromStep: 2,
          previousStepResults: expect.arrayContaining([
            expect.objectContaining({ stepId: 0 }),
            expect.objectContaining({ stepId: 1, type: StepType.USER_INPUT }),
          ]),
        })
      );
    });

    it('should handle execution failure after resume', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        currentStepId: 1,
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
      });

      const failureResult = createMockResult(false);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(waitingSession);
      vi.mocked(mockExecutor.execute).mockResolvedValue(failureResult);
      mockSessionStorage.updateSession = vi.fn();

      const result = await manager.resumeSession('session-waiting', {
        userInput: 'test',
      });

      expect(result.success).toBe(false);

      // Verify final updateSession call with failed status
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-waiting',
        expect.objectContaining({
          status: 'failed',
          result: expect.objectContaining({
            success: false,
          }),
          completedAt: expect.any(String),
        })
      );
    });

    it('should update context with user input values', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        currentStepId: 1,
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
        context: { previousData: 'oldValue' },
      });

      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(waitingSession);
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      await manager.resumeSession('session-waiting', {
        companyName: '华为技术有限公司',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      // Verify context merge
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-waiting',
        expect.objectContaining({
          context: expect.objectContaining({
            previousData: 'oldValue',
            companyName: '华为技术有限公司',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          }),
        })
      );
    });

    it('should append user input step result to existing step results', async () => {
      const waitingSession = createMockSession({
        id: 'session-waiting',
        status: 'waiting_input',
        currentStepId: 1,
        pendingInput: {
          surfaceId: 'test-surface',
          stepId: 1,
          schema: { fields: [] },
        },
        stepResults: [
          {
            stepId: 0,
            type: StepType.FUNCTION_CALL,
            functionName: 'firstStep',
            parameters: {},
            result: 'result0',
            success: true,
            executedAt: '2024-01-01T00:00:00.000Z',
          },
        ] as any,
      });

      const successResult = createMockResult(true);

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(waitingSession);
      vi.mocked(mockExecutor.execute).mockResolvedValue(successResult);
      mockSessionStorage.updateSession = vi.fn();

      await manager.resumeSession('session-waiting', { userInput: 'test' });

      // Verify step results are appended
      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-waiting',
        expect.objectContaining({
          stepResults: expect.arrayContaining([
            expect.objectContaining({ stepId: 0 }),
            expect.objectContaining({ stepId: 1, type: StepType.USER_INPUT }),
          ]),
        })
      );
    });

    it('should throw error when session is already completed', async () => {
      const completedSession = createMockSession({
        status: 'completed',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(completedSession);

      await expect(
        manager.resumeSession('session-test-001', { test: 'value' })
      ).rejects.toThrow('Cannot resume session with status: completed');
    });
  });

  // ============================================
  // getSessionStatus
  // ============================================

  describe('getSessionStatus', () => {
    it('should return session status', async () => {
      const session = createMockSession({ status: 'completed' });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(session);

      const status = await manager.getSessionStatus('session-test-001');

      expect(status).toBe('completed');
    });

    it('should return undefined if session not found', async () => {
      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(undefined);

      const status = await manager.getSessionStatus('non-existent');

      expect(status).toBeUndefined();
    });
  });

  // ============================================
  // cancelSession
  // ============================================

  describe('cancelSession', () => {
    it('should cancel a pending session', async () => {
      const pendingSession = createMockSession({
        id: 'session-pending',
        status: 'pending',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(pendingSession);
      mockSessionStorage.updateSession = vi.fn();

      await manager.cancelSession('session-pending');

      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-pending',
        expect.objectContaining({
          status: 'failed',
          result: expect.objectContaining({
            success: false,
            error: 'Session cancelled by user',
          }),
          completedAt: expect.any(String),
        })
      );
    });

    it('should cancel a running session', async () => {
      const runningSession = createMockSession({
        status: 'running',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(runningSession);
      mockSessionStorage.updateSession = vi.fn();

      await manager.cancelSession('session-test-001');

      expect(mockSessionStorage.updateSession).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(undefined);

      await expect(
        manager.cancelSession('non-existent')
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should throw error if session is already completed', async () => {
      const completedSession = createMockSession({
        status: 'completed',
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(completedSession);

      await expect(
        manager.cancelSession('session-test-001')
      ).rejects.toThrow('Cannot cancel session with status: completed');
    });

    it('should preserve existing step results when canceling', async () => {
      const runningSession = createMockSession({
        status: 'running',
        stepResults: [
          {
            stepId: 0,
            type: StepType.FUNCTION_CALL,
            functionName: 'test',
            parameters: {},
            result: 'result',
            success: true,
            executedAt: '2024-01-01T00:00:00.000Z',
          },
        ] as any,
      });

      vi.mocked(mockSessionStorage.loadSession).mockResolvedValue(runningSession);
      mockSessionStorage.updateSession = vi.fn();

      await manager.cancelSession('session-test-001');

      expect(mockSessionStorage.updateSession).toHaveBeenCalledWith(
        'session-test-001',
        expect.objectContaining({
          result: expect.objectContaining({
            steps: runningSession.stepResults,
          }),
        })
      );
    });
  });
});
