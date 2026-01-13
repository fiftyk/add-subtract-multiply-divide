import 'reflect-metadata';
import { injectable } from 'inversify';
import fs from 'fs/promises';
import path from 'path';
import type { PlanRefinementSession } from '../types.js';
import type { PlanRefinementSessionStorage } from './interfaces/PlanRefinementSessionStorage.js';

/**
 * Plan Refinement Session 存储管理
 *
 * 职责：
 * - 持久化 Plan 改进会话到文件系统 (.data/refinement-sessions/)
 * - 加载和更新会话
 * - 支持会话列表查询
 *
 * 文件格式：
 * - .data/refinement-sessions/session-{uuid}.json
 */
@injectable()
export class PlanRefinementSessionStorageImpl implements PlanRefinementSessionStorage {
  private refinementSessionsDir: string;

  constructor(dataDir: string = '.data') {
    this.refinementSessionsDir = path.join(dataDir, 'refinement-sessions');
  }

  /**
   * 保存会话
   */
  async saveSession(session: PlanRefinementSession): Promise<void> {
    // 确保目录存在
    await fs.mkdir(this.refinementSessionsDir, { recursive: true });

    const filePath = this.getSessionPath(session.sessionId);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * 加载会话
   */
  async loadSession(sessionId: string): Promise<PlanRefinementSession | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PlanRefinementSession;
    } catch (error) {
      // 文件不存在或 JSON 格式错误
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' ||
        error instanceof SyntaxError
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 更新会话（增量更新）
   */
  async updateSession(
    sessionId: string,
    updates: Partial<PlanRefinementSession>
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession: PlanRefinementSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveSession(updatedSession);
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<PlanRefinementSession[]> {
    try {
      await fs.mkdir(this.refinementSessionsDir, { recursive: true });
      const files = await fs.readdir(this.refinementSessionsDir);

      const sessions: PlanRefinementSession[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
      }

      // 按更新时间倒序排列
      return sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在，忽略
        return;
      }
      throw error;
    }
  }

  /**
   * 获取会话文件路径
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.refinementSessionsDir, `${sessionId}.json`);
  }
}
