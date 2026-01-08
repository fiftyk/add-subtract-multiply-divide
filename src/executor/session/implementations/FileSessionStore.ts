/**
 * File Session Store
 *
 * File-based implementation of ExecutionSessionStore.
 * Used for Web production environment where persistence across restarts is needed.
 */

import { injectable } from 'inversify';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { ExecutionSessionStore } from '../interfaces/SessionStore.js';
import type { ExecutionSession } from '../types.js';
import { ConfigManager } from '../../../config/index.js';
import { LoggerFactory } from '../../../logger/index.js';
import type { ILogger } from '../../../logger/index.js';

/**
 * File Session Store Implementation
 *
 * Stores sessions as JSON files in .data/execution-sessions/ directory.
 * Sessions persist across process restarts.
 */
@injectable()
export class FileSessionStore implements ExecutionSessionStore {
  private logger: ILogger;
  private sessionsDir: string;

  constructor() {
    this.logger = LoggerFactory.create(undefined, 'FileSessionStore');
    const dataDir = ConfigManager.get().storage.dataDir;
    this.sessionsDir = join(dataDir, 'execution-sessions');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  private getSessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`);
  }

  async saveSession(session: ExecutionSession): Promise<void> {
    await this.ensureDir();
    const path = this.getSessionPath(session.id);
    await fs.writeFile(path, JSON.stringify(session, null, 2), 'utf-8');
    this.logger.debug('Session saved', { sessionId: session.id });
  }

  async loadSession(id: string): Promise<ExecutionSession | undefined> {
    const path = this.getSessionPath(id);
    try {
      const content = await fs.readFile(path, 'utf-8');
      const session = JSON.parse(content) as ExecutionSession;
      this.logger.debug('Session loaded', { sessionId: id });
      return session;
    } catch (error) {
      this.logger.debug('Session not found', { sessionId: id });
      return undefined;
    }
  }

  async updateSession(
    id: string,
    updates: Partial<ExecutionSession>
  ): Promise<void> {
    const session = await this.loadSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: ExecutionSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveSession(updated);
    this.logger.debug('Session updated', { sessionId: id });
  }

  async deleteSession(id: string): Promise<void> {
    const path = this.getSessionPath(id);
    try {
      await fs.unlink(path);
      this.logger.debug('Session deleted', { sessionId: id });
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async listSessions(): Promise<ExecutionSession[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.sessionsDir);
    const sessions: ExecutionSession[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(join(this.sessionsDir, file), 'utf-8');
        const session = JSON.parse(content) as ExecutionSession;
        sessions.push(session);
      } catch {
        // Skip corrupted files
        this.logger.warn('Failed to read session file', { file });
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}
