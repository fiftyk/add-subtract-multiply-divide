/**
 * Web Bindings - Web 端特有的服务绑定
 *
 * 这些服务仅在 Web 环境中使用
 */

import type { Container } from 'inversify';
import { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
import { A2UIService } from '../a2ui/A2UIService.js';
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
}
