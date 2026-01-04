/**
 * A2UI 会话工厂实现
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { A2UISession, A2UISessionFactory, A2UISessionOptions, SurfaceManager, MessageSender } from '../interfaces/index.js';
import { A2UISessionImpl } from '../implementations/A2UISession.js';
import { SurfaceManager as SurfaceManagerSymbol, MessageSender as MessageSenderSymbol } from '../interfaces/index.js';
import type { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { LocalFunctionProviderSymbol } from '../../function-provider/symbols.js';

@injectable()
export class A2UISessionFactoryImpl implements A2UISessionFactory {
  private sessions: Map<string, A2UISession> = new Map();

  constructor(
    @inject(SurfaceManagerSymbol) private surfaceManager: SurfaceManager,
    @inject(MessageSenderSymbol) private messageSender: MessageSender,
    @inject(LocalFunctionProviderSymbol) private functionProvider: FunctionProvider
  ) {}

  create(options?: A2UISessionOptions): A2UISession {
    const session = new A2UISessionImpl(this.surfaceManager, this.messageSender, this.functionProvider);
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): A2UISession | undefined {
    return this.sessions.get(sessionId);
  }
}
