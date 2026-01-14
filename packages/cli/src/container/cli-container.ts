/**
 * CLI Container - CLI 端专用容器
 *
 * 仅加载核心服务 + CLI 特有服务，不加载 Web 端实现
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { registerCoreBindings } from '@fn-orchestrator/core/container/core.js';
import { registerCLIBindings } from './cli.js';
import { MockServiceFactory } from '@fn-orchestrator/core/function-completion/factory/MockServiceFactory.js';

const container = new Container({
  defaultScope: 'Singleton',
});

// 注册核心服务（跨端共享）
registerCoreBindings(container);

// 注册 CLI 特有服务
registerCLIBindings(container);

export { container, MockServiceFactory };
export default container;
