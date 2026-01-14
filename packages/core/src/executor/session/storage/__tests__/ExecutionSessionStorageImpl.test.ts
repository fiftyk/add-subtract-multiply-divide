import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExecutionSessionStorageImpl } from '../ExecutionSessionStorageImpl.js';
import type { ExecutionSessionStorage } from '../../interfaces/ExecutionSessionStorage.js';
import type { ExecutionSession } from '../../types.js';
import type { ExecutionPlan } from '../../../../planner/types.js';
import { StepType } from '../../../../planner/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('ExecutionSessionStorageImpl', () => {
  const testDataDir = '.data-test-execution-sessions';
  let storage: ExecutionSessionStorage;

  beforeEach(async () => {
    storage = new ExecutionSessionStorageImpl(testDataDir);
    // 确保测试目录存在
    await fs.mkdir(path.join(testDataDir, 'execution-sessions'), { recursive: true });
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略删除错误
    }
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

  // ============================================
  // Basic CRUD Operations
  // ============================================

  describe('saveSession and loadSession', () => {
    it('should save and load a session', async () => {
      const session = createMockSession();
      await storage.saveSession(session);

      const loaded = await storage.loadSession('session-test-001');
      expect(loaded).toEqual(session);
    });

    it('should return undefined for non-existent session', async () => {
      const loaded = await storage.loadSession('non-existent');
      expect(loaded).toBeUndefined();
    });

    it('should overwrite existing session on save', async () => {
      const session = createMockSession({
        id: 'session-test-002',
        status: 'pending',
      });

      await storage.saveSession(session);

      // 更新 session
      session.status = 'completed';
      session.updatedAt = '2024-01-01T01:00:00.000Z';

      await storage.saveSession(session);

      const loaded = await storage.loadSession('session-test-002');
      expect(loaded?.status).toBe('completed');
      expect(loaded?.updatedAt).toBe('2024-01-01T01:00:00.000Z');
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const session = createMockSession({
        id: 'session-test-003',
        status: 'pending',
      });

      await storage.saveSession(session);

      await storage.updateSession('session-test-003', {
        status: 'completed',
      });

      const loaded = await storage.loadSession('session-test-003');
      expect(loaded?.status).toBe('completed');
      expect(loaded?.planId).toBe('plan-test'); // 其他字段保持不变
      // updatedAt 应该被自动更新
      expect(loaded?.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
    });

    it('should throw error when updating non-existent session', async () => {
      await expect(
        storage.updateSession('non-existent', { status: 'completed' })
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const session = createMockSession({
        id: 'session-test-004',
      });

      await storage.saveSession(session);
      expect(await storage.loadSession('session-test-004')).toBeDefined();

      await storage.deleteSession('session-test-004');
      expect(await storage.loadSession('session-test-004')).toBeUndefined();
    });

    it('should not throw error when deleting non-existent session', async () => {
      await expect(
        storage.deleteSession('non-existent')
      ).resolves.not.toThrow();
    });
  });

  // ============================================
  // Query Operations
  // ============================================

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      const session1 = createMockSession({
        id: 'session-test-005',
        planId: 'plan-abc',
        basePlanId: 'plan-abc',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const session2 = createMockSession({
        id: 'session-test-006',
        planId: 'plan-xyz',
        basePlanId: 'plan-xyz',
        status: 'failed',
        createdAt: '2024-01-02T00:00:00.000Z',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessions();
      expect(sessions).toHaveLength(2);

      // 应该按创建时间倒序排列（最新的在前）
      expect(sessions[0].id).toBe('session-test-006');
      expect(sessions[1].id).toBe('session-test-005');
    });

    it('should return empty array when no sessions exist', async () => {
      const sessions = await storage.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should filter by planId', async () => {
      const session1 = createMockSession({
        id: 'session-test-007',
        planId: 'plan-abc',
        basePlanId: 'plan-abc',
      });

      const session2 = createMockSession({
        id: 'session-test-008',
        planId: 'plan-xyz',
        basePlanId: 'plan-xyz',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessions({ planId: 'plan-abc' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-test-007');
    });

    it('should filter by basePlanId', async () => {
      const session1 = createMockSession({
        id: 'session-test-009',
        planId: 'plan-abc-v1',
        basePlanId: 'plan-abc',
        planVersion: 1,
      });

      const session2 = createMockSession({
        id: 'session-test-010',
        planId: 'plan-abc-v2',
        basePlanId: 'plan-abc',
        planVersion: 2,
      });

      const session3 = createMockSession({
        id: 'session-test-011',
        planId: 'plan-xyz',
        basePlanId: 'plan-xyz',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);
      await storage.saveSession(session3);

      const sessions = await storage.listSessions({ basePlanId: 'plan-abc' });
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain('session-test-009');
      expect(sessions.map((s) => s.id)).toContain('session-test-010');
    });

    it('should filter by status', async () => {
      const session1 = createMockSession({
        id: 'session-test-012',
        status: 'completed',
      });

      const session2 = createMockSession({
        id: 'session-test-013',
        status: 'failed',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessions({ status: 'completed' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-test-012');
    });

    it('should filter by platform', async () => {
      const session1 = createMockSession({
        id: 'session-test-014',
        platform: 'cli',
      });

      const session2 = createMockSession({
        id: 'session-test-015',
        platform: 'web',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessions({ platform: 'web' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-test-015');
    });

    it('should apply pagination with limit and offset', async () => {
      // 创建 5 个 session
      for (let i = 0; i < 5; i++) {
        const session = createMockSession({
          id: `session-test-${100 + i}`,
          createdAt: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
        await storage.saveSession(session);
      }

      // 获取前 2 个
      const page1 = await storage.listSessions({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      expect(page1[0].id).toBe('session-test-104'); // 最新的

      // 获取接下来 2 个
      const page2 = await storage.listSessions({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(page2[0].id).toBe('session-test-102');
    });

    it('should handle invalid session files gracefully', async () => {
      // 创建一个无效的 session 文件
      const sessionsDir = path.join(testDataDir, 'execution-sessions');
      await fs.writeFile(
        path.join(sessionsDir, 'invalid-session.json'),
        'invalid json content'
      );

      const sessions = await storage.listSessions();
      // 应该忽略无效文件，返回空数组
      expect(sessions).toEqual([]);
    });
  });

  describe('listSessionsByPlan', () => {
    it('should list sessions for a specific plan', async () => {
      const session1 = createMockSession({
        id: 'session-test-016',
        planId: 'plan-abc',
      });

      const session2 = createMockSession({
        id: 'session-test-017',
        planId: 'plan-abc',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessionsByPlan('plan-abc');
      expect(sessions).toHaveLength(2);
    });
  });

  describe('listSessionsByBasePlan', () => {
    it('should list sessions for all versions of a plan', async () => {
      const session1 = createMockSession({
        id: 'session-test-018',
        planId: 'plan-abc-v1',
        basePlanId: 'plan-abc',
        planVersion: 1,
      });

      const session2 = createMockSession({
        id: 'session-test-019',
        planId: 'plan-abc-v2',
        basePlanId: 'plan-abc',
        planVersion: 2,
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessionsByBasePlan('plan-abc');
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getRecentSessions', () => {
    it('should return the most recent sessions', async () => {
      for (let i = 0; i < 5; i++) {
        const session = createMockSession({
          id: `session-test-${200 + i}`,
          createdAt: `2024-01-0${i + 1}T00:00:00.000Z`,
        });
        await storage.saveSession(session);
      }

      const recent = await storage.getRecentSessions(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].id).toBe('session-test-204'); // 最新的
      expect(recent[1].id).toBe('session-test-203');
      expect(recent[2].id).toBe('session-test-202');
    });
  });

  // ============================================
  // Statistics Operations
  // ============================================

  describe('getExecutionStats', () => {
    it('should calculate statistics for a plan', async () => {
      const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();

      // 2 个成功的执行
      const session1 = createMockSession({
        id: 'session-test-020',
        planId: 'plan-stats',
        basePlanId: 'plan-stats',
        status: 'completed',
        result: {
          planId: 'plan-stats',
          success: true,
          steps: [],
          finalResult: 'ok',
          startedAt: new Date(baseTime).toISOString(),
          completedAt: new Date(baseTime + 1000).toISOString(),
        },
        createdAt: new Date(baseTime).toISOString(),
        completedAt: new Date(baseTime + 1000).toISOString(),
      });

      const session2 = createMockSession({
        id: 'session-test-021',
        planId: 'plan-stats',
        basePlanId: 'plan-stats',
        status: 'completed',
        result: {
          planId: 'plan-stats',
          success: true,
          steps: [],
          finalResult: 'ok',
          startedAt: new Date(baseTime).toISOString(),
          completedAt: new Date(baseTime + 2000).toISOString(),
        },
        createdAt: new Date(baseTime).toISOString(),
        completedAt: new Date(baseTime + 2000).toISOString(),
      });

      // 1 个失败的执行
      const session3 = createMockSession({
        id: 'session-test-022',
        planId: 'plan-stats',
        basePlanId: 'plan-stats',
        status: 'failed',
        result: {
          planId: 'plan-stats',
          success: false,
          error: 'Test error',
          steps: [],
          finalResult: undefined,
          startedAt: new Date(baseTime).toISOString(),
          completedAt: new Date(baseTime + 500).toISOString(),
        },
        createdAt: new Date(baseTime).toISOString(),
        completedAt: new Date(baseTime + 500).toISOString(),
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);
      await storage.saveSession(session3);

      const stats = await storage.getExecutionStats('plan-stats');

      expect(stats.totalExecutions).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.averageDuration).toBe(1500); // (1000 + 2000 + 500) / 3
    });

    it('should return zero stats for plan with no executions', async () => {
      const stats = await storage.getExecutionStats('non-existent-plan');

      expect(stats.totalExecutions).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });

    it('should work with base plan ID', async () => {
      const session1 = createMockSession({
        id: 'session-test-023',
        planId: 'plan-base-v1',
        basePlanId: 'plan-base',
        planVersion: 1,
        status: 'completed',
        result: {
          planId: 'plan-base-v1',
          success: true,
          steps: [],
          finalResult: 'ok',
          startedAt: '2024-01-01T00:00:00.000Z',
          completedAt: '2024-01-01T00:00:01.000Z',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      });

      const session2 = createMockSession({
        id: 'session-test-024',
        planId: 'plan-base-v2',
        basePlanId: 'plan-base',
        planVersion: 2,
        status: 'completed',
        result: {
          planId: 'plan-base-v2',
          success: true,
          steps: [],
          finalResult: 'ok',
          startedAt: '2024-01-01T00:00:00.000Z',
          completedAt: '2024-01-01T00:00:01.000Z',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
      });

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      // 使用 base plan ID 查询应该包含所有版本
      const stats = await storage.getExecutionStats('plan-base');

      expect(stats.totalExecutions).toBe(2);
      expect(stats.successCount).toBe(2);
    });
  });
});
