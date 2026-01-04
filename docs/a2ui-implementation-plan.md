# A2UI 协议实现方案

## 设计原则

**依赖倒置原则 (DIP)**：
- 高层模块不依赖低层模块，都依赖抽象
- 抽象不依赖细节，细节依赖抽象
- 使用依赖注入实现松耦合

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           A2UI Protocol Layer                            │
├─────────────────────────────────────────────────────────────────────────┤
│  抽象层 (所有依赖通过接口)                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ A2UISession  │  │ SurfaceManager│ │ ComponentCatalogRegistry    │  │
│  │              │  │              │  │                              │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┬──────────────┘  │
│         │                 │                          │                   │
│         ↓                 ↓                          ↓                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ A2UISession  │  │ SurfaceManager│ │ ComponentCatalogRegistry     │  │
│  │ (实现)       │  │ (实现)       │  │ (实现)                       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  传输层 (抽象)                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ MessageSender  │  │ MessageReceiver│ │ Transport                 │  │
│  │ (消息发送)     │  │ (消息接收)     │  │ (传输抽象)               │  │
│  └────────────────┘  └────────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  外部依赖 (抽象)                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Logger       │  │ Storage      │  │ SessionRepository            │  │
│  │ (日志)       │  │ (存储)       │  │ (会话存储)                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     Existing Integration Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Interactive  │  │ Function     │  │ ConfigManager                │  │
│  │ Session      │  │ Registry     │  │                              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. 接口定义 (依赖抽象)

### 2.1 核心接口 (`src/a2ui/interfaces/`)

```
src/a2ui/
└── interfaces/
    ├── A2UISession.ts              # A2UI 会话接口
    ├── SurfaceManager.ts           # Surface 管理器接口
    ├── ComponentCatalog.ts         # 组件目录接口
    ├── ComponentCatalogRegistry.ts # 组件目录注册表接口
    ├── MessageSender.ts            # 消息发送者接口
    ├── MessageReceiver.ts          # 消息接收者接口
    ├── Transport.ts                # 传输层接口
    ├── A2UISessionFactory.ts       # A2UI 会话工厂接口
    ├── SurfaceFactory.ts           # Surface 工厂接口
    ├── A2UIMessage.ts              # 消息类型定义（无状态）
    ├── Component.ts                # 组件定义（无状态）
    └── BoundValue.ts               # 数据绑定（无状态）
```

### 2.2 接口代码

#### A2UISession.ts
```typescript
import type { SurfaceUpdateMessage, DataModelUpdateMessage, BeginRenderingMessage, DeleteSurfaceMessage, UserActionMessage } from './A2UIMessage.js';

export const A2UISession = Symbol('A2UISession');

/**
 * A2UI 会话接口
 *
 * 管理一个完整的 A2UI 交互会话
 * 依赖注入此接口以解耦
 */
export interface A2UISession {
  /** 会话 ID */
  readonly sessionId: string;

  /** 创建时间 */
  readonly createdAt: Date;

  /**
   * 创建 Surface
   * @param surfaceId Surface 标识
   */
  createSurface(surfaceId: string): void;

  /**
   * 发送 Surface Update 消息
   * @param surfaceId Surface 标识
   * @param components 组件列表
   */
  sendSurfaceUpdate(surfaceId: string, components: Component[]): void;

  /**
   * 发送 Data Model Update 消息
   * @param surfaceId Surface 标识
   * @param data 数据对象
   * @param path 可选路径（支持嵌套更新）
   */
  sendDataModelUpdate(surfaceId: string, data: Record<string, unknown>, path?: string): void;

  /**
   * 发送 Begin Rendering 消息
   * @param surfaceId Surface 标识
   * @param catalogId 组件目录 ID
   * @param rootComponentId 根组件 ID
   */
  beginRendering(surfaceId: string, catalogId: string, rootComponentId: string): void;

  /**
   * 删除 Surface
   * @param surfaceId Surface 标识
   */
  deleteSurface(surfaceId: string): void;

  /**
   * 处理用户动作
   * @param action 用户动作消息
   */
  handleUserAction(action: UserActionMessage): void;

  /**
   * 注册动作处理器
   * @param actionName 动作名称
   * @param handler 处理函数
   */
  onAction(actionName: string, handler: (action: UserActionMessage) => void): void;

  /**
   * 订阅消息
   * @param subscriberId 订阅者 ID
   * @param callback 回调函数
   */
  subscribe(subscriberId: string, callback: (message: string) => void): void;

  /**
   * 取消订阅
   * @param subscriberId 订阅者 ID
   */
  unsubscribe(subscriberId: string): void;
}
```

#### SurfaceManager.ts
```typescript
export const SurfaceManager = Symbol('SurfaceManager');

/**
 * Surface 管理器接口
 *
 * 管理 Surface 的生命周期和状态
 */
export interface SurfaceManager {
  /**
   * 创建 Surface
   * @param surfaceId Surface 标识
   * @returns Surface 状态
   */
  createSurface(surfaceId: string): SurfaceState;

  /**
   * 获取 Surface 状态
   * @param surfaceId Surface 标识
   * @returns Surface 状态或 undefined
   */
  getSurface(surfaceId: string): SurfaceState | undefined;

  /**
   * 删除 Surface
   * @param surfaceId Surface 标识
   */
  deleteSurface(surfaceId: string): void;

  /**
   * 获取所有 Surface
   * @returns 所有 Surface 状态
   */
  getAllSurfaces(): Iterable<SurfaceState>;

  /**
   * 检查 Surface 是否存在
   * @param surfaceId Surface 标识
   */
  hasSurface(surfaceId: string): boolean;
}

/**
 * Surface 状态
 */
export interface SurfaceState {
  readonly surfaceId: string;
  components: Map<string, Component>;
  rootComponentId: string | null;
  dataModel: Record<string, unknown>;
  catalogId: string | null;
  readonly createdAt: Date;
}
```

#### ComponentCatalogRegistry.ts
```typescript
import type { ComponentCatalog } from './ComponentCatalog.js';

export const ComponentCatalogRegistry = Symbol('ComponentCatalogRegistry');

/**
 * 组件目录注册表接口
 *
 * 管理组件目录的注册和查找
 */
export interface ComponentCatalogRegistry {
  /**
   * 注册目录
   * @param catalogId 目录 ID
   * @param catalog 目录实现
   */
  register(catalogId: string, catalog: ComponentCatalog): void;

  /**
   * 获取目录
   * @param catalogId 目录 ID
   * @returns 目录或 undefined
   */
  get(catalogId: string): ComponentCatalog | undefined;

  /**
   * 获取标准目录
   * @returns 标准目录
   */
  getStandardCatalog(): ComponentCatalog;

  /**
   * 检查目录是否存在
   * @param catalogId 目录 ID
   */
  has(catalogId: string): boolean;
}

/**
 * 组件目录接口
 */
export interface ComponentCatalog {
  /** 目录 ID */
  readonly id: string;

  /** 目录名称 */
  readonly name: string;

  /**
   * 获取组件定义
   * @param componentType 组件类型名称
   * @returns 组件定义或 undefined
   */
  getComponentDefinition(componentType: string): ComponentDefinition | undefined;

  /**
   * 获取所有组件类型
   * @returns 组件类型名称列表
   */
  getComponentTypes(): string[];

  /**
   * 验证组件是否有效
   * @param component 组件
   * @returns 验证结果
   */
  validateComponent(component: Component): { valid: boolean; errors: string[] };
}

/**
 * 组件定义
 */
export interface ComponentDefinition {
  properties: Record<string, PropertyDefinition>;
  events?: string[];
  children?: ChildrenDefinition;
}

/**
 * 属性定义
 */
export interface PropertyDefinition {
  type: 'bound' | 'literal' | 'enum' | 'array' | 'object';
  types?: string[];
  values?: (string | number)[];
  required?: boolean;
}

/**
 * 子组件定义
 */
export interface ChildrenDefinition {
  mode: 'explicit' | 'template' | 'single';
  templateDataBinding?: string;
}
```

#### MessageSender.ts
```typescript
export const MessageSender = Symbol('MessageSender');

/**
 * 消息发送者接口
 *
 * 负责将 A2UI 消息发送到客户端
 */
export interface MessageSender {
  /**
   * 发送消息到特定会话
   * @param sessionId 会话 ID
   * @param message 消息
   */
  send(sessionId: string, message: string): void;

  /**
   * 广播消息到多个会话
   * @param sessionIds 会话 ID 列表
   * @param message 消息
   */
  broadcast(sessionIds: string[], message: string): void;

  /**
   * 发送消息到特定 Surface
   * @param sessionId 会话 ID
   * @param surfaceId Surface 标识
   * @param message 消息
   */
  sendToSurface(sessionId: string, surfaceId: string, message: string): void;
}
```

#### MessageReceiver.ts
```typescript
import type { UserActionMessage, A2UIErrorMessage } from './A2UIMessage.js';

export const MessageReceiver = Symbol('MessageReceiver');

/**
 * 消息接收者接口
 *
 * 负责接收来自客户端的消息
 */
export interface MessageReceiver {
  /**
   * 接收用户动作
   * @param sessionId 会话 ID
   * @param action 用户动作
   */
  receiveUserAction(sessionId: string, action: UserActionMessage): void;

  /**
   * 接收错误报告
   * @param sessionId 会话 ID
   * @param error 错误信息
   */
  receiveError(sessionId: string, error: A2UIErrorMessage): void;

  /**
   * 设置错误处理程序
   * @param handler 处理函数
   */
  onError(handler: (sessionId: string, error: A2UIErrorMessage) => void): void;
}
```

#### Transport.ts
```typescript
export const Transport = Symbol('Transport');

/**
 * 传输层接口
 *
 * 抽象底层传输机制（HTTP SSE、WebSocket 等）
 */
export interface Transport {
  /** 传输类型 */
  readonly type: 'sse' | 'websocket' | 'http';

  /**
   * 启动传输服务
   */
  start(): Promise<void>;

  /**
   * 停止传输服务
   */
  stop(): Promise<void>;

  /**
   * 检查是否运行中
   */
  isRunning(): boolean;
}

/**
 * SSE 传输配置
 */
export interface SSEServerConfig {
  port: number;
  path: string;
  heartbeatInterval?: number;
}

/**
 * WebSocket 传输配置
 */
export interface WebSocketConfig {
  port: number;
  path: string;
  heartbeatInterval?: number;
  maxConnections?: number;
}
```

#### A2UISessionFactory.ts
```typescript
import type { A2UISession } from './A2UISession.js';

export const A2UISessionFactory = Symbol('A2UISessionFactory');

/**
 * A2UI 会话工厂接口
 */
export interface A2UISessionFactory {
  /**
   * 创建新会话
   * @param options 会话选项
   * @returns A2UI 会话实例
   */
  create(options?: A2UISessionOptions): A2UISession;
}

/**
 * 会话选项
 */
export interface A2UISessionOptions {
  sessionId?: string;
  userId?: string;
  initialSurfaceId?: string;
}
```

#### SurfaceFactory.ts
```typescript
import type { SurfaceConfig } from './SurfaceFactory.js';

export const SurfaceFactory = Symbol('SurfaceFactory');

/**
 * Surface 工厂接口
 */
export interface SurfaceFactory {
  /**
   * 创建 Surface
   * @param sessionId 会话 ID
   * @param surfaceId Surface 标识
   * @param catalogId 组件目录 ID
   * @returns Surface 配置
   */
  create(sessionId: string, surfaceId: string, catalogId: string): SurfaceConfig;
}

/**
 * Surface 配置
 */
export interface SurfaceConfig {
  surfaceId: string;
  catalogId: string;
  components: Component[];
  dataModel?: Record<string, unknown>;
}
```

## 3. 依赖注入配置

### 3.1 容器绑定 (`src/a2ui/container.ts`)

```typescript
import { Container } from 'inversify';

// 绑定接口到实现
export function bindA2UIContainer(container: Container): void {
  // 核心服务
  container.bind(A2UISession).to(A2UISessionImpl).inTransientScope();
  container.bind(SurfaceManager).to(SurfaceManagerImpl).inSingletonScope();
  container.bind(ComponentCatalogRegistry).to(ComponentCatalogRegistryImpl).inSingletonScope();

  // 传输层
  container.bind(Transport).to(SSEServerTransport).inSingletonScope();
  container.bind(MessageSender).to(MessageSenderImpl).inSingletonScope();
  container.bind(MessageReceiver).to(MessageReceiverImpl).inSingletonScope();

  // 组件目录
  container.bind(ComponentCatalog).to(StandardCatalog).whenNamed('standard');
  container.bind(ComponentCatalog).to(CustomCatalog).whenNamed('custom');

  // 工厂
  container.bind(A2UISessionFactory).to(A2UISessionFactoryImpl);
  container.bind(SurfaceFactory).to(SurfaceFactoryImpl);
}

// 从容器获取实例的便捷函数
export function getA2UIService<T>(container: Container, symbol: symbol): T {
  return container.get<T>(symbol);
}
```

### 3.2 服务定位器模式（可选）

```typescript
// 对于不便使用依赖注入的场景
export class A2UIServiceLocator {
  private static instance: A2UIServiceLocator;
  private services: Map<symbol, unknown> = new Map();

  static getInstance(): A2UIServiceLocator {
    if (!this.instance) {
      this.instance = new A2UIServiceLocator();
    }
    return this.instance;
  }

  register<T>(symbol: symbol, service: T): void {
    this.services.set(symbol, service);
  }

  get<T>(symbol: symbol): T {
    const service = this.services.get(symbol);
    if (!service) {
      throw new Error(`Service not found: ${symbol.description}`);
    }
    return service as T;
  }
}
```

## 4. 工厂模式

### 4.1 A2UI 会话工厂

```typescript
import 'reflect-metadata';
import { injectable } from 'inversify';
import type { A2UISession, A2UISessionFactory, A2UISessionOptions } from '../interfaces/index.js';

@injectable()
export class A2UISessionFactoryImpl implements A2UISessionFactory {
  constructor(
    private sessionClass: new (options: A2UISessionOptions) => A2UISession
  ) {}

  create(options?: A2UISessionOptions): A2UISession {
    return new this.sessionClass(options || {});
  }
}
```

### 4.2 Surface 工厂

```typescript
import 'reflect-metadata';
import { injectable } from 'inversify';
import type { SurfaceFactory, SurfaceConfig } from '../interfaces/index.js';

@injectable()
export class SurfaceFactoryImpl implements SurfaceFactory {
  create(sessionId: string, surfaceId: string, catalogId: string): SurfaceConfig {
    return {
      surfaceId,
      catalogId,
      components: [],
      dataModel: {},
    };
  }
}
```

## 5. 抽象基类（模板方法模式）

### 5.1 抽象传输基类

```typescript
export abstract class AbstractTransport implements Transport {
  protected running = false;
  protected config: TransportConfig;

  constructor(config: TransportConfig) {
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  isRunning(): boolean {
    return this.running;
  }

  protected log(message: string): void {
    console.log(`[A2UI Transport] ${message}`);
  }

  protected error(message: string, err: Error): void {
    console.error(`[A2UI Transport] ${message}`, err);
  }
}
```

### 5.2 抽象消息处理器

```typescript
export abstract class AbstractMessageHandler {
  protected next: AbstractMessageHandler | null = null;

  setNext(handler: AbstractMessageHandler): AbstractMessageHandler {
    this.next = handler;
    return handler;
  }

  abstract handle(message: A2UIMessage): boolean;

  protected handleNext(message: A2UIMessage): boolean {
    if (this.next) {
      return this.next.handle(message);
    }
    return false;
  }
}
```

## 6. 测试友好设计

### 6.1 Mock 实现

```typescript
// 测试用的 Mock A2UI 会话
export class MockA2UISession implements A2UISession {
  readonly sessionId = 'mock-session';
  readonly createdAt = new Date();
  messages: string[] = [];
  actions: UserActionMessage[] = [];

  createSurface(surfaceId: string): void {}
  sendSurfaceUpdate(surfaceId: string, components: Component[]): void {
    this.messages.push(JSON.stringify({ surfaceUpdate: { surfaceId, components } }));
  }
  sendDataModelUpdate(surfaceId: string, data: Record<string, unknown>, path?: string): void {}
  beginRendering(surfaceId: string, catalogId: string, rootComponentId: string): void {}
  deleteSurface(surfaceId: string): void {}
  handleUserAction(action: UserActionMessage): void {
    this.actions.push(action);
  }
  onAction(actionName: string, handler: (action: UserActionMessage) => void): void {}
  subscribe(subscriberId: string, callback: (message: string) => void): void {}
  unsubscribe(subscriberId: string): void {}
}

// 测试用的 Mock 传输
export class MockTransport implements Transport {
  type = 'sse' as const;
  private running = false;
  messages: { sessionId: string; message: string }[] = [];

  async start(): Promise<void> {
    this.running = true;
  }
  async stop(): Promise<void> {
    this.running = false;
  }
  isRunning(): boolean {
    return this.running;
  }
  send(sessionId: string, message: string): void {
    this.messages.push({ sessionId, message });
  }
}
```

### 6.2 Vitest 测试示例

```typescript
// __tests__/a2ui/A2UISession.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { A2UISession, A2UISessionFactory } from '../interfaces/index.js';
import { SurfaceManager, MessageSender } from '../interfaces/index.js';
import { A2UISessionImpl } from '../implementations/A2UISession.js';
import { MockSurfaceManager } from '../mocks/MockSurfaceManager.js';
import { MockMessageSender } from '../mocks/MockMessageSender.js';

describe('A2UISession', () => {
  let container: Container;
  let session: A2UISession;
  let messageSender: MockMessageSender;

  beforeEach(() => {
    container = new Container();

    // 绑定 Mock 实现
    container.bind(SurfaceManager).to(MockSurfaceManager).inSingletonScope();
    container.bind(MessageSender).to(MockMessageSender).inSingletonScope();
    container.bind(A2UISession).to(A2UISessionImpl);

    session = container.get(A2UISession);
    messageSender = container.get(MessageSender);
  });

  describe('createSurface', () => {
    it('should create a new surface', () => {
      session.createSurface('main');

      const surfaceManager = container.get(SurfaceManager);
      expect(surfaceManager.getSurface('main')).toBeDefined();
    });
  });

  describe('sendSurfaceUpdate', () => {
    it('should send surface update message', () => {
      session.createSurface('main');
      session.sendSurfaceUpdate('main', [
        { id: 'text1', component: { Text: { text: { literalString: 'Hello' } } } }
      ]);

      expect(messageSender.messages.length).toBe(1);
      expect(messageSender.messages[0].sessionId).toBe(session.sessionId);
    });
  });
});
```

## 7. 项目结构

```
src/
└── a2ui/
    ├── interfaces/                    # 抽象接口（依赖倒置）
    │   ├── A2UISession.ts
    │   ├── SurfaceManager.ts
    │   ├── ComponentCatalog.ts
    │   ├── ComponentCatalogRegistry.ts
    │   ├── MessageSender.ts
    │   ├── MessageReceiver.ts
    │   ├── Transport.ts
    │   ├── A2UISessionFactory.ts
    │   ├── SurfaceFactory.ts
    │   ├── A2UIMessage.ts             # 消息类型（无状态）
    │   ├── Component.ts               # 组件定义（无状态）
    │   └── BoundValue.ts              # 数据绑定（无状态）
    │
    ├── implementations/               # 具体实现
    │   ├── A2UISession.ts
    │   ├── SurfaceManager.ts
    │   ├── ComponentCatalogRegistry.ts
    │   ├── MessageSender.ts
    │   ├── MessageReceiver.ts
    │   └── transports/
    │       ├── SSEServerTransport.ts
    │       └── WebSocketTransport.ts
    │
    ├── catalog/                       # 组件目录
    │   ├── StandardCatalog.ts
    │   └── CustomCatalog.ts
    │
    ├── factory/                       # 工厂
    │   ├── A2UISessionFactory.ts
    │   └── SurfaceFactory.ts
    │
    ├── container.ts                   # 依赖注入配置
    │
    ├── index.ts                       # 导出
    │
    └── __tests__/                     # 测试
        ├── A2UISession.test.ts
        └── mocks/
            ├── MockA2UISession.ts
            ├── MockSurfaceManager.ts
            └── MockTransport.ts
```

## 8. 使用示例

### 8.1 创建 A2UI 会话（通过依赖注入）

```typescript
import { Container } from 'inversify';
import { A2UISession, A2UISessionFactory, SurfaceManager, MessageSender } from './interfaces/index.js';
import { bindA2UIContainer } from './container.js';

async function main() {
  const container = new Container();
  bindA2UIContainer(container);

  // 通过工厂创建会话
  const factory = container.get<A2UISessionFactory>(A2UISessionFactory);
  const session = factory.create({
    userId: 'user-123',
    initialSurfaceId: 'main',
  });

  // 使用会话
  session.sendSurfaceUpdate('main', [
    { id: 'title', component: { Text: { text: { literalString: 'Hello!' } } } }
  ]);

  session.beginRendering('main', 'standard', 'title');
}
```

### 8.2 测试中使用 Mock

```typescript
import { Container } from 'inversify';
import { A2UISession, SurfaceManager, MessageSender } from './interfaces/index.js';
import { MockA2UISession, MockSurfaceManager, MockMessageSender } from './mocks/index.js';

describe('A2UI Integration', () => {
  let container: Container;
  let session: A2UISession;
  let messageSender: MockMessageSender;

  beforeEach(() => {
    container = new Container();

    // 使用 Mock 实现
    container.bind(A2UISession).to(MockA2UISession);
    container.bind(SurfaceManager).to(MockSurfaceManager);
    container.bind(MessageSender).to(MockMessageSender);

    session = container.get(A2UISession);
    messageSender = container.get(MessageSender);
  });

  it('should handle user action', async () => {
    // 测试逻辑
  });
});
```

## 9. 命名约定总结

| 类别 | 命名模式 | 示例 |
|------|----------|------|
| 接口 | 描述性名称 | `A2UISession`, `SurfaceManager`, `MessageSender` |
| Symbol | 同接口名 | `Symbol('A2UISession')` |
| 实现类 | `Impl` 后缀 | `A2UISessionImpl`, `SurfaceManagerImpl` |
| Mock 类 | `Mock` 前缀 | `MockA2UISession`, `MockTransport` |
| 工厂类 | `Factory` 后缀 | `A2UISessionFactoryImpl` |
| 配置文件 | `Config` 后缀 | `SSEServerConfig`, `WebSocketConfig` |

## 10. 总结

本方案遵循的设计原则：

| 原则 | 实现方式 |
|------|----------|
| **依赖倒置 (DIP)** | 所有模块依赖接口，不依赖实现 |
| **单一职责 (SRP)** | 每个类/接口只负责一个功能 |
| **开闭原则 (OCP)** | 通过接口扩展新功能，不修改现有代码 |
| **里氏替换 (LSP)** | Mock 实现可以替换真实实现 |
| **接口隔离 (ISP)** | 小而专注的接口 |
| **依赖注入** | 使用 InversifyJS 容器管理依赖 |
| **工厂模式** | 创建会话和 Surface 的工厂 |
| **模板方法** | 抽象基类定义骨架 |
| **测试友好** | 所有依赖都可 Mock |
