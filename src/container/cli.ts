/**
 * CLI Bindings - CLI 端特有的服务绑定
 *
 * 这些服务仅在 CLI 环境中使用
 */

import type { Container } from 'inversify';
import { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
import { CLIRenderer } from '../a2ui/adapters/CLIRenderer.js';
import { A2UIService } from '../a2ui/A2UIService.js';
import { ExecutionSessionStore } from '../executor/session/interfaces/SessionStore.js';
import { MemorySessionStore } from '../executor/session/implementations/MemorySessionStore.js';

/**
 * 注册 CLI 端特有的服务绑定
 */
export function registerCLIBindings(container: Container): void {
  // ============================================
  // A2UIRenderer - CLIRenderer 实现
  // ============================================
  container.bind(A2UIRenderer).to(CLIRenderer);

  // ============================================
  // A2UIService - 使用 renderer 的高级 API
  // ============================================
  container.bind(A2UIService).toDynamicValue(() => {
    const renderer = container.get<A2UIRenderer>(A2UIRenderer);
    return new A2UIService(renderer);
  });

  // ============================================
  // ExecutionSessionStore - 内存存储 (CLI 场景)
  // ============================================
  // CLI 使用内存存储，进程结束后会话自动清理
  container.bind(ExecutionSessionStore).to(MemorySessionStore);
}
