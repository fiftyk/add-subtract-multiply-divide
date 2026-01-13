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
 * 检查是否在 Web 服务器环境中运行
 */
function isWebServer(): boolean {
  // 检查是否通过 web-server 启动（通过环境变量或模块检测）
  const result = process.env.WEB_SERVER === 'true' ||
    process.argv[1]?.includes('web-server') ||
    process.argv[1]?.includes('dist/index.js');
  console.error(`[CLI-Bindings] isWebServer check: env=${process.env.WEB_SERVER}, argv[1]=${process.argv[1]}, result=${result}`);
  return result;
}

/**
 * 注册 CLI 端特有的服务绑定
 */
export function registerCLIBindings(container: Container): void {
  // ============================================
  // A2UIRenderer - 仅在 CLI 模式下绑定
  // ============================================
  // 在 Web 服务器模式下不绑定 A2UIRenderer，因为 Web 场景不需要交互式输入
  if (!isWebServer()) {
    container.bind(A2UIRenderer).to(CLIRenderer);

    // ============================================
    // A2UIService - 使用 renderer 的高级 API
    // ============================================
    container.bind(A2UIService).toDynamicValue(() => {
      const renderer = container.get<A2UIRenderer>(A2UIRenderer);
      return new A2UIService(renderer);
    });
  }

  // ============================================
  // ExecutionSessionStore - 内存存储 (CLI 场景)
  // ============================================
  // CLI 使用内存存储，进程结束后会话自动清理
  container.bind(ExecutionSessionStore).to(MemorySessionStore);
}
