/**
 * A2UI 依赖注入配置
 */

import { Container } from 'inversify';

// Symbols
import {
  A2UISession,
  SurfaceManager,
  ComponentCatalog,
  ComponentCatalogRegistry,
  MessageSender,
  MessageReceiver,
  Transport,
  A2UISessionFactory,
  SurfaceFactory,
} from './interfaces/index.js';

// Implementations
import { A2UISessionImpl } from './implementations/A2UISession.js';
import { SurfaceManagerImpl } from './implementations/SurfaceManager.js';
import { ComponentCatalogRegistryImpl } from './implementations/ComponentCatalogRegistry.js';
import { MessageSenderImpl } from './implementations/MessageSender.js';
import { MessageReceiverImpl } from './implementations/MessageReceiver.js';
import { SSEServerTransport } from './transports/SSEServerTransport.js';
import type { SSEServerConfig } from './interfaces/Transport.js';
import { A2UISessionFactoryImpl } from './factory/A2UISessionFactory.js';
import { SurfaceFactoryImpl } from './factory/SurfaceFactory.js';
import { StandardCatalog } from './catalog/StandardCatalog.js';

/**
 * 绑定 A2UI 模块到容器
 */
export function bindA2UIContainer(container: Container, config?: { sse?: SSEServerConfig }): void {
  // 核心服务
  container.bind(A2UISession).to(A2UISessionImpl).inTransientScope();
  container.bind(SurfaceManager).to(SurfaceManagerImpl).inSingletonScope();
  container.bind(ComponentCatalogRegistry).to(ComponentCatalogRegistryImpl).inSingletonScope();

  // 传输层
  container.bind(Transport).toDynamicValue(() => {
    const sseConfig: SSEServerConfig = config?.sse || { port: 3000, path: '/a2ui/stream' };
    const messageSender = container.get<MessageSender>(MessageSender);
    return new SSEServerTransport(messageSender, sseConfig);
  }).inSingletonScope();

  container.bind(MessageSender).to(MessageSenderImpl).inSingletonScope();
  container.bind(MessageReceiver).to(MessageReceiverImpl).inSingletonScope();

  // 组件目录
  container.bind(ComponentCatalogRegistry).toDynamicValue(() => {
    const registry = new ComponentCatalogRegistryImpl();
    const standardCatalog = new StandardCatalog();
    registry.setStandardCatalog(standardCatalog);
    registry.register(standardCatalog.id, standardCatalog);
    return registry;
  }).inSingletonScope();

  // 工厂
  container.bind(A2UISessionFactory).to(A2UISessionFactoryImpl);
  container.bind(SurfaceFactory).to(SurfaceFactoryImpl);
}

/**
 * 获取 A2UI 服务
 */
export function getA2UIService<T>(container: Container, symbol: symbol): T {
  return container.get<T>(symbol);
}
