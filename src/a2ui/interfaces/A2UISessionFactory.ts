/**
 * A2UI 会话工厂接口
 */

import type { A2UISession, A2UISessionOptions } from './A2UISession.js';

export const A2UISessionFactory = Symbol('A2UISessionFactory');

/**
 * A2UI 会话工厂接口
 */
export interface A2UISessionFactory {
  /**
   * 创建新会话
   */
  create(options?: A2UISessionOptions): A2UISession;

  /**
   * 获取现有会话
   */
  getSession(sessionId: string): A2UISession | undefined;
}
