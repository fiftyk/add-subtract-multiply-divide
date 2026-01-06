/**
 * Web Bindings - Web 端特有的服务绑定
 *
 * 这些服务仅在 Web 环境中使用
 */

import type { Container } from 'inversify';
import { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
import { A2UIService } from '../a2ui/A2UIService.js';
import { ExecutionSessionStore } from '../executor/session/interfaces/SessionStore.js';
import { FileSessionStore } from '../executor/session/implementations/FileSessionStore.js';
import { InterruptibleExecutor } from '../executor/interfaces/InterruptibleExecutor.js';
import { WebInterruptibleExecutor } from '../executor/implementations/WebInterruptibleExecutor.js';
import type { WebRendererImpl } from '../web/WebA2UIRenderer.js';

/**
 * 注册 Web 端特有的服务绑定
 */
export async function registerWebBindings(container: Container): Promise<void> {
  // 动态导入以避免循环依赖
  const { WebRendererImpl } = await import('../web/WebA2UIRenderer.js');

  // ============================================
  // A2UIRenderer - WebRenderer 实现
  // ============================================
  container.bind(A2UIRenderer).to(WebRendererImpl);

  // ============================================
  // A2UIService - 使用 renderer 的高级 API
  // ============================================
  container.bind(A2UIService).toDynamicValue(() => {
    const renderer = container.get<A2UIRenderer>(A2UIRenderer);
    return new A2UIService(renderer);
  });

  // ============================================
  // ExecutionSessionStore - 文件存储 (Web 场景)
  // ============================================
  // Web 使用文件存储，支持进程重启后恢复会话
  container.bind(ExecutionSessionStore).to(FileSessionStore);

  // ============================================
  // InterruptibleExecutor - Web 可中断执行器
  // ============================================
  container.bind(InterruptibleExecutor).to(WebInterruptibleExecutor);
}
