/**
 * Web Container - Web 端专用容器
 * 
 * 仅加载核心服务 + Web 特有服务，不加载 CLI 端实现
 * TODO: 实现 WebRenderer 后完善
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { registerCoreBindings } from './core.js';
import { registerWebBindings } from './web.js';
import { MockServiceFactory } from '../function-completion/factory/MockServiceFactory.js';

const container = new Container({
  defaultScope: 'Singleton',
});

// 注册核心服务（跨端共享）
registerCoreBindings(container);

// 注册 Web 特有服务
registerWebBindings(container);

export { container, MockServiceFactory };
export default container;
