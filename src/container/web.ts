/**
 * Web Bindings - Web 端特有的服务绑定
 * 
 * 这些服务仅在 Web 环境中使用
 * TODO: 实现 WebRenderer 后添加绑定
 */

import type { Container } from 'inversify';
// import { A2UIRenderer } from '../a2ui/A2UIRenderer.js';
// import { WebRenderer } from '../a2ui/adapters/WebRenderer.js';
// import { A2UIService } from '../a2ui/A2UIService.js';

/**
 * 注册 Web 端特有的服务绑定
 */
export function registerWebBindings(container: Container): void {
  // TODO: 实现 WebRenderer 后取消注释
  // container.bind(A2UIRenderer).to(WebRenderer);
  // container.bind(A2UIService).toDynamicValue(() => {
  //   const renderer = container.get<A2UIRenderer>(A2UIRenderer);
  //   return new A2UIService(renderer);
  // });
}
