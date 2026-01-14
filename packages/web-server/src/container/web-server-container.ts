/**
 * Web Server Container - Web 服务器专用容器
 *
 * 加载核心服务 + Web 服务器特有服务
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { registerCoreBindings } from '@fn-orchestrator/core/container/core.js';
import { A2UIRenderer } from '@fn-orchestrator/core/a2ui/A2UIRenderer.js';
import { MockA2UIRenderer } from '../services/WebA2UIRenderer.js';

const container = new Container({
  defaultScope: 'Singleton',
});

// 注册核心服务（跨端共享）
registerCoreBindings(container);

// 绑定 Web 服务器专用的 MockA2UIRenderer
// Web 模式下，UI 更新通过 SSE 事件处理，而不是直接渲染
container.bind(A2UIRenderer).to(MockA2UIRenderer);
console.log('[WebServer] Bound MockA2UIRenderer for web mode');

export default container;
