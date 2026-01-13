/**
 * Execution Session Storage Implementation
 *
 * File-based persistent storage for ExecutionSession objects.
 * Stores sessions as JSON files in .data/execution-sessions/ directory.
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  ExecutionSessionStorage as IExecutionSessionStorage,
  ListSessionsOptions,
  ExecutionStats,
} from '../interfaces/ExecutionSessionStorage.js';
import type { ExecutionSession } from '../types.js';
import type { ExecutionStatus } from '../../../a2ui/types.js';

/**
 * ExecutionSessionStorageImpl
 *
 * File-based implementation of ExecutionSessionStorage.
 * Uses atomic writes (tmp + rename) to ensure data integrity.
 */
@injectable()
export class ExecutionSessionStorageImpl implements IExecutionSessionStorage {
  private sessionsDir: string;

  constructor(dataDir: string = '.data') {
    this.sessionsDir = join(dataDir, 'execution-sessions');
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Ensure the sessions directory exists
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  /**
   * Get the file path for a session
   */
  private getSessionPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Atomic write: write to temp file then rename
   */
  private async atomicWrite(
    sessionId: string,
    session: ExecutionSession
  ): Promise<void> {
    const targetPath = this.getSessionPath(sessionId);
    const tmpPath = `${targetPath}.tmp`;

    await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tmpPath, targetPath);
  }

  /**
   * Read and parse a session file
   */
  private async readSessionFile(
    sessionId: string
  ): Promise<ExecutionSession | undefined> {
    const path = this.getSessionPath(sessionId);
    try {
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content) as ExecutionSession;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Load all session files from directory
   */
  private async loadAllSessions(): Promise<ExecutionSession[]> {
    await this.ensureDir();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: ExecutionSession[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.tmp')) continue;

        try {
          const content = await fs.readFile(
            join(this.sessionsDir, file),
            'utf-8'
          );
          const session = JSON.parse(content) as ExecutionSession;
          sessions.push(session);
        } catch {
          // Skip corrupted files
          console.warn(`Skipping corrupted session file: ${file}`);
        }
      }

      return sessions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Filter sessions based on options
   */
  private filterSessions(
    sessions: ExecutionSession[],
    options?: ListSessionsOptions
  ): ExecutionSession[] {
    if (!options) return sessions;

    let filtered = sessions;

    if (options.planId) {
      filtered = filtered.filter((s) => s.planId === options.planId);
    }

    if (options.basePlanId) {
      filtered = filtered.filter((s) => s.basePlanId === options.basePlanId);
    }

    if (options.status) {
      filtered = filtered.filter((s) => s.status === options.status);
    }

    if (options.platform) {
      filtered = filtered.filter((s) => s.platform === options.platform);
    }

    return filtered;
  }

  /**
   * Sort sessions by creation time (newest first) and apply pagination
   */
  private sortAndPaginate(
    sessions: ExecutionSession[],
    options?: ListSessionsOptions
  ): ExecutionSession[] {
    const sorted = sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (!options) return sorted;

    const offset = options.offset || 0;
    const limit = options.limit || sorted.length;

    return sorted.slice(offset, offset + limit);
  }

  // ============================================
  // Basic CRUD Operations
  // ============================================

  async saveSession(session: ExecutionSession): Promise<void> {
    await this.ensureDir();
    await this.atomicWrite(session.id, session);
  }

  async loadSession(sessionId: string): Promise<ExecutionSession | undefined> {
    return this.readSessionFile(sessionId);
  }

  async updateSession(
    sessionId: string,
    updates: Partial<ExecutionSession>
  ): Promise<void> {
    const session = await this.readSessionFile(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: ExecutionSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.atomicWrite(sessionId, updated);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const path = this.getSessionPath(sessionId);
    try {
      await fs.unlink(path);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ============================================
  // Query Operations
  // ============================================

  async listSessions(
    options?: ListSessionsOptions
  ): Promise<ExecutionSession[]> {
    const allSessions = await this.loadAllSessions();
    const filtered = this.filterSessions(allSessions, options);
    return this.sortAndPaginate(filtered, options);
  }

  async listSessionsByPlan(planId: string): Promise<ExecutionSession[]> {
    return this.listSessions({ planId });
  }

  async listSessionsByBasePlan(basePlanId: string): Promise<ExecutionSession[]> {
    return this.listSessions({ basePlanId });
  }

  async getRecentSessions(limit: number): Promise<ExecutionSession[]> {
    return this.listSessions({ limit });
  }

  // ============================================
  // Statistics Operations
  // ============================================

  async getExecutionStats(planId: string): Promise<ExecutionStats> {
    // Load sessions for this plan (could be base ID or versioned ID)
    let sessions = await this.listSessionsByPlan(planId);

    // If no sessions found with exact match, try as base plan ID
    if (sessions.length === 0) {
      sessions = await this.listSessionsByBasePlan(planId);
    }

    const totalExecutions = sessions.length;
    const successCount = sessions.filter(
      (s) => s.status === 'completed' && s.result?.success
    ).length;
    const failureCount = sessions.filter(
      (s) => s.status === 'failed' || (s.status === 'completed' && !s.result?.success)
    ).length;

    // Calculate average duration for completed sessions
    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' && s.completedAt
    );

    let averageDuration = 0;
    if (completedSessions.length > 0) {
      const totalDuration = completedSessions.reduce((sum, session) => {
        const start = new Date(session.createdAt).getTime();
        const end = new Date(session.completedAt!).getTime();
        return sum + (end - start);
      }, 0);
      averageDuration = totalDuration / completedSessions.length;
    }

    return {
      totalExecutions,
      successCount,
      failureCount,
      averageDuration,
    };
  }
}
