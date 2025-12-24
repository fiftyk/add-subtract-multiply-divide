import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStorageImpl } from '../storage/SessionStorage.js';
import type { SessionStorage } from '../storage/interfaces/SessionStorage.js';
import type { InteractionSession } from '../types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('SessionStorage', () => {
  const testDataDir = '.data-test-sessions';
  let storage: SessionStorage;

  beforeEach(async () => {
    storage = new SessionStorageImpl(testDataDir);
    // 确保测试目录存在
    await fs.mkdir(path.join(testDataDir, 'sessions'), { recursive: true });
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略删除错误
    }
  });

  describe('saveSession and loadSession', () => {
    it('should save and load a session', async () => {
      const session: InteractionSession = {
        sessionId: 'session-test-001',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [
          {
            role: 'user',
            content: '计算 3 + 5',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active',
      };

      await storage.saveSession(session);

      const loaded = await storage.loadSession('session-test-001');
      expect(loaded).toEqual(session);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.loadSession('non-existent');
      expect(loaded).toBeNull();
    });

    it('should overwrite existing session on save', async () => {
      const session: InteractionSession = {
        sessionId: 'session-test-002',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active',
      };

      await storage.saveSession(session);

      // 更新 session
      session.currentVersion = 2;
      session.messages.push({
        role: 'user',
        content: 'Updated',
        timestamp: '2024-01-01T00:01:00.000Z',
      });

      await storage.saveSession(session);

      const loaded = await storage.loadSession('session-test-002');
      expect(loaded?.currentVersion).toBe(2);
      expect(loaded?.messages).toHaveLength(1);
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const session: InteractionSession = {
        sessionId: 'session-test-003',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active',
      };

      await storage.saveSession(session);

      await storage.updateSession('session-test-003', {
        currentVersion: 2,
        status: 'completed',
      });

      const loaded = await storage.loadSession('session-test-003');
      expect(loaded?.currentVersion).toBe(2);
      expect(loaded?.status).toBe('completed');
      expect(loaded?.planId).toBe('plan-abc'); // 其他字段保持不变
    });

    it('should throw error when updating non-existent session', async () => {
      await expect(
        storage.updateSession('non-existent', { currentVersion: 2 })
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      const session1: InteractionSession = {
        sessionId: 'session-test-004',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active',
      };

      const session2: InteractionSession = {
        sessionId: 'session-test-005',
        planId: 'plan-xyz',
        currentVersion: 2,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'completed',
      };

      await storage.saveSession(session1);
      await storage.saveSession(session2);

      const sessions = await storage.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain('session-test-004');
      expect(sessions.map((s) => s.sessionId)).toContain('session-test-005');
    });

    it('should return empty array when no sessions exist', async () => {
      const sessions = await storage.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should handle invalid session files gracefully', async () => {
      // 创建一个无效的 session 文件
      const sessionsDir = path.join(testDataDir, 'sessions');
      await fs.writeFile(
        path.join(sessionsDir, 'invalid-session.json'),
        'invalid json content'
      );

      const sessions = await storage.listSessions();
      // 应该忽略无效文件，返回空数组
      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const session: InteractionSession = {
        sessionId: 'session-test-006',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        status: 'active',
      };

      await storage.saveSession(session);
      expect(await storage.loadSession('session-test-006')).not.toBeNull();

      await storage.deleteSession('session-test-006');
      expect(await storage.loadSession('session-test-006')).toBeNull();
    });

    it('should not throw error when deleting non-existent session', async () => {
      await expect(
        storage.deleteSession('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('session messages', () => {
    it('should preserve message order and metadata', async () => {
      const session: InteractionSession = {
        sessionId: 'session-test-007',
        planId: 'plan-abc',
        currentVersion: 1,
        messages: [
          {
            role: 'user',
            content: '第一条消息',
            timestamp: '2024-01-01T00:00:00.000Z',
            metadata: {
              action: 'create',
              planVersion: 1,
            },
          },
          {
            role: 'assistant',
            content: '第二条消息',
            timestamp: '2024-01-01T00:00:01.000Z',
            metadata: {
              action: 'create',
              planVersion: 1,
            },
          },
          {
            role: 'user',
            content: '第三条消息',
            timestamp: '2024-01-01T00:00:02.000Z',
            metadata: {
              action: 'refine',
              planVersion: 2,
            },
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:02.000Z',
        status: 'active',
      };

      await storage.saveSession(session);
      const loaded = await storage.loadSession('session-test-007');

      expect(loaded?.messages).toHaveLength(3);
      expect(loaded?.messages[0].content).toBe('第一条消息');
      expect(loaded?.messages[1].content).toBe('第二条消息');
      expect(loaded?.messages[2].content).toBe('第三条消息');
      expect(loaded?.messages[2].metadata?.planVersion).toBe(2);
    });
  });
});
