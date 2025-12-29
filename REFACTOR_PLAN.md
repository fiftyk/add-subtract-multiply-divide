# Function Discovery & Execution Architecture Refactoring Plan

## 目标
重构当前混乱的函数发现和执行机制，建立清晰的策略模式架构。

## 当前问题

### 1. 概念重叠
- `FunctionRegistry`: 本地函数注册+执行
- `RemoteFunctionRegistry`: 远程函数发现+执行
- `ToolProvider`: 工具发现（仅用于 Planner）
- 三个概念职责不清，层次混乱

### 2. Executor 耦合度高
```typescript
// src/executor/executor.ts:242-277
// Executor 需要同时依赖两个不同的接口
constructor(
  @inject(FunctionRegistry) registry: FunctionRegistry,
  @inject(RemoteFunctionRegistry) remoteRegistry?: RemoteFunctionRegistry
) {
  // 执行时需要分别处理
  if (this.registry.has(step.functionName)) {
    // 本地执行
  } else if (this.remoteRegistry?.has(step.functionName)) {
    // 远程执行
  }
}
```
违反开闭原则：每增加一种函数类型都要修改 Executor。

### 3. 职责分散
- **发现层**: `LocalFunctionToolProvider` + `RemoteToolProvider` → `CompositeToolProvider`
- **执行层**: `LocalFunctionRegistry` + `MCPClient` → Executor 手动调度
- 发现和执行逻辑分散在不同层次

## 重构方案

### 核心理念
使用**策略模式（Strategy Pattern）**统一函数发现和执行接口：

1. **FunctionProvider**: 统一抽象接口（发现 + 执行）
2. **LocalFunctionProvider**: 本地实现策略
3. **RemoteFunctionProvider**: 远程实现策略（抽象基类）
   - **MCPFunctionProvider**: MCP 协议实现
   - **HTTPFunctionProvider**: HTTP API 实现（未来）
4. **CompositeFunctionProvider**: 组合多个 Provider（优先级调度）

### 架构图

```
                    FunctionProvider (策略接口)
                          ↑
                          |
        ┌─────────────────┼─────────────────┐
        |                 |                 |
LocalFunctionProvider  RemoteFunctionProvider  CompositeFunctionProvider
                          ↑
                          |
            ┌─────────────┴──────────┐
            |                        |
    MCPFunctionProvider    HTTPFunctionProvider (未来)
```

### 接口设计

```typescript
// src/function-provider/interfaces/FunctionProvider.ts

/**
 * 函数元数据（统一格式）
 */
export interface FunctionMetadata {
  name: string;
  description: string;
  scenario: string;
  parameters: ParameterDef[];
  returns: ReturnDef;

  // Provider 信息
  providerType: 'local' | 'remote';
  source: string;  // e.g., "local", "mcp://server-name", "http://api.example.com"
}

/**
 * 执行结果（统一格式）
 */
export interface FunctionExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    provider?: string;
  };
}

/**
 * 函数提供者统一接口
 * 职责：函数发现 + 函数执行
 */
export interface FunctionProvider {
  /**
   * 获取 Provider 类型
   */
  getType(): 'local' | 'remote' | 'composite';

  /**
   * 获取来源信息
   */
  getSource(): string;

  /**
   * 列出所有可用函数
   */
  list(): Promise<FunctionMetadata[]>;

  /**
   * 检查函数是否存在
   */
  has(name: string): Promise<boolean>;

  /**
   * 获取函数元数据
   */
  get(name: string): Promise<FunctionMetadata | undefined>;

  /**
   * 执行函数
   */
  execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult>;

  /**
   * 初始化 Provider（可选）
   * 用于建立连接、加载资源等
   */
  initialize?(): Promise<void>;

  /**
   * 清理资源（可选）
   */
  dispose?(): Promise<void>;
}

/**
 * FunctionProvider Symbol（依赖注入）
 */
export const FunctionProvider = Symbol('FunctionProvider');
```

## 实施步骤

### Phase 1: 创建新接口和实现 ✓

#### 1.1 创建 FunctionProvider 接口
- [ ] `src/function-provider/interfaces/FunctionProvider.ts`
- [ ] `src/function-provider/types.ts` (FunctionMetadata, FunctionExecutionResult)

#### 1.2 实现 LocalFunctionProvider
- [ ] `src/function-provider/LocalFunctionProvider.ts`
  - 包装现有 `LocalFunctionRegistry` 的功能
  - 实现 `FunctionProvider` 接口
  - 保留 `register()` 方法（本地特有）

```typescript
// src/function-provider/LocalFunctionProvider.ts
@injectable()
export class LocalFunctionProvider implements FunctionProvider {
  private functions: Map<string, FunctionDefinition> = new Map();

  getType() { return 'local' as const; }
  getSource() { return 'local'; }

  // 本地特有：注册函数
  register(fn: FunctionDefinition): void {
    this.functions.set(fn.name, fn);
  }

  async list(): Promise<FunctionMetadata[]> {
    return Array.from(this.functions.values()).map(toMetadata);
  }

  async has(name: string): Promise<boolean> {
    return this.functions.has(name);
  }

  async get(name: string): Promise<FunctionMetadata | undefined> {
    const fn = this.functions.get(name);
    return fn ? toMetadata(fn) : undefined;
  }

  async execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult> {
    // 执行逻辑（复用现有代码）
  }
}
```

#### 1.3 创建 RemoteFunctionProvider 抽象基类
- [ ] `src/function-provider/remote/RemoteFunctionProvider.ts`

```typescript
// src/function-provider/remote/RemoteFunctionProvider.ts
export abstract class RemoteFunctionProvider implements FunctionProvider {
  getType() { return 'remote' as const; }
  abstract getSource(): string;

  // 子类实现具体的发现和执行逻辑
  abstract list(): Promise<FunctionMetadata[]>;
  abstract has(name: string): Promise<boolean>;
  abstract get(name: string): Promise<FunctionMetadata | undefined>;
  abstract execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult>;

  // 可选：连接管理
  abstract initialize?(): Promise<void>;
  abstract dispose?(): Promise<void>;
}
```

#### 1.4 实现 MCPFunctionProvider
- [ ] `src/function-provider/remote/MCPFunctionProvider.ts`
  - 继承 `RemoteFunctionProvider`
  - 包装现有 `MCPClient` 的功能
  - 实现连接管理、工具发现、工具调用

```typescript
// src/function-provider/remote/MCPFunctionProvider.ts
@injectable()
export class MCPFunctionProvider extends RemoteFunctionProvider {
  private client: MCPClient;
  private serverName: string;

  constructor(config: MCPClientConfig) {
    super();
    this.client = new MCPClient(config);
    this.serverName = config.name;
  }

  getSource(): string {
    return `mcp://${this.serverName}`;
  }

  async initialize(): Promise<void> {
    await this.client.connect();
  }

  async list(): Promise<FunctionMetadata[]> {
    const tools = await this.client.list();
    return tools.map(convertToMetadata);
  }

  async execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult> {
    const result = await this.client.execute(name, params);
    return {
      success: result.success,
      result: result.content,
      error: result.error,
    };
  }

  async dispose(): Promise<void> {
    await this.client.disconnect();
  }
}
```

#### 1.5 实现 CompositeFunctionProvider
- [ ] `src/function-provider/CompositeFunctionProvider.ts`
  - 持有多个 `FunctionProvider` 实例
  - 按优先级查找函数（本地优先）
  - 执行时自动路由到正确的 Provider

```typescript
// src/function-provider/CompositeFunctionProvider.ts
@injectable()
export class CompositeFunctionProvider implements FunctionProvider {
  private providers: FunctionProvider[];

  constructor(
    @multiInject(FunctionProvider) providers: FunctionProvider[]
  ) {
    // 排序：local 优先
    this.providers = providers.sort((a, b) =>
      a.getType() === 'local' ? -1 : 1
    );
  }

  getType() { return 'composite' as const; }
  getSource() { return 'composite'; }

  async list(): Promise<FunctionMetadata[]> {
    const results = await Promise.all(
      this.providers.map(p => p.list())
    );
    return results.flat();
  }

  async has(name: string): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.has(name)) return true;
    }
    return false;
  }

  async get(name: string): Promise<FunctionMetadata | undefined> {
    for (const provider of this.providers) {
      const fn = await provider.get(name);
      if (fn) return fn;
    }
    return undefined;
  }

  async execute(name: string, params: Record<string, unknown>): Promise<FunctionExecutionResult> {
    // 找到第一个拥有该函数的 Provider 并执行
    for (const provider of this.providers) {
      if (await provider.has(name)) {
        return await provider.execute(name, params);
      }
    }
    throw new Error(`Function not found: ${name}`);
  }
}
```

### Phase 2: 重构 Planner 和 Executor ✓

#### 2.1 重构 Planner
- [ ] 修改 `PlannerImpl` 构造函数
  - 移除 `ToolProvider` 依赖
  - 改为依赖 `FunctionProvider`
  - 从 `FunctionProvider.list()` 获取可用函数列表

```typescript
// src/planner/planner.ts
@injectable()
export class PlannerImpl implements Planner {
  constructor(
    @inject(FunctionProvider) private functionProvider: FunctionProvider,
    @inject(PlannerLLMClient) private llmClient: PlannerLLMClient
  ) {}

  async generatePlan(requirement: string): Promise<ExecutionPlan> {
    // 获取所有可用函数
    const functions = await this.functionProvider.list();

    // 转换为 LLM 需要的格式
    const tools = functions.map(formatForLLM);

    // 调用 LLM 生成计划
    // ...
  }
}
```

#### 2.2 重构 Executor
- [ ] 修改 `ExecutorImpl` 构造函数
  - 移除 `FunctionRegistry` 和 `RemoteFunctionRegistry` 依赖
  - 改为依赖 `FunctionProvider`
  - 执行时直接调用 `functionProvider.execute()`

```typescript
// src/executor/executor.ts
@injectable()
export class ExecutorImpl implements Executor {
  constructor(
    @inject(FunctionProvider) private functionProvider: FunctionProvider,
    @inject(UserInputProvider) private userInputProvider?: UserInputProvider
  ) {}

  private async executeFunctionCall(
    step: FunctionCallStep,
    context: ExecutionContext
  ): Promise<FunctionCallResult> {
    const resolvedParams = context.resolveParameters(step.parameters);

    // 统一执行接口，无需判断类型
    const result = await this.functionProvider.execute(
      step.functionName,
      resolvedParams
    );

    if (result.success) {
      return {
        stepId: step.stepId,
        type: StepType.FUNCTION_CALL,
        functionName: step.functionName,
        parameters: resolvedParams,
        result: result.result,
        success: true,
        executedAt: new Date().toISOString(),
      };
    } else {
      throw new Error(result.error);
    }
  }
}
```

### Phase 3: 更新容器配置 ✓

#### 3.1 配置 FunctionProvider 绑定
- [ ] 修改 `src/container.ts`

```typescript
// src/container.ts

// 1. 本地函数 Provider
container.bind<FunctionProvider>(FunctionProvider)
  .to(LocalFunctionProvider)
  .whenTargetNamed('local');

// 2. MCP 远程 Provider（根据配置动态创建）
container.bind<FunctionProvider>(FunctionProvider)
  .toDynamicValue(() => {
    const config = ConfigManager.get();
    if (config.mcp.servers.length === 0) {
      return null; // 不绑定
    }
    const serverConfig = config.mcp.servers[0];
    return new MCPFunctionProvider({
      name: serverConfig.name,
      transportType: serverConfig.type,
      transportConfig: serverConfig,
    });
  })
  .whenTargetNamed('mcp')
  .onActivation((_, instance) => {
    // 自动初始化连接
    instance.initialize?.();
    return instance;
  });

// 3. 组合 Provider（默认）
container.bind<FunctionProvider>(FunctionProvider)
  .to(CompositeFunctionProvider);
```

#### 3.2 保留向后兼容（渐进式迁移）
- [ ] 保留 `FunctionRegistry` Symbol，指向 `LocalFunctionProvider`
- [ ] CLI 命令逐步迁移到新接口

```typescript
// 向后兼容绑定
container.bind(FunctionRegistry).toService(FunctionProvider);
```

### Phase 4: 清理旧代码 ✓

#### 4.1 移除冗余层
- [ ] 删除 `ToolProvider` 及相关实现
  - `LocalFunctionToolProvider`
  - `RemoteToolProvider`
  - `CompositeToolProvider`
- [ ] 删除 `RemoteFunctionRegistry` 接口
- [ ] 重命名 `FunctionRegistry` 为 `LegacyFunctionRegistry`（标记为 deprecated）

#### 4.2 更新测试
- [ ] 重写 `Planner` 测试（使用 mock `FunctionProvider`）
- [ ] 重写 `Executor` 测试（使用 mock `FunctionProvider`）
- [ ] 添加 `CompositeFunctionProvider` 集成测试

#### 4.3 更新文档
- [ ] 更新 `CLAUDE.md`
- [ ] 更新 `docs/architecture.md`（如果存在）
- [ ] 添加 `docs/function-provider-guide.md`（使用指南）

## 优势

### 1. 符合 SOLID 原则
- **单一职责（SRP）**: 每个 Provider 只负责一种类型的函数
- **开闭原则（OCP）**: 新增函数类型无需修改现有代码，只需添加新的 Provider
- **里氏替换（LSP）**: 所有 Provider 可以互相替换
- **接口隔离（ISP）**: 统一的接口，消费者无需知道实现细节
- **依赖倒置（DIP）**: Planner 和 Executor 依赖抽象接口，不依赖具体实现

### 2. 扩展性强
添加新的函数来源（如 HTTP API、gRPC、WebSocket）只需：
1. 创建新的 `RemoteFunctionProvider` 子类
2. 在容器中注册
3. Planner 和 Executor 无需修改

### 3. 职责清晰
```
FunctionProvider:
  - 发现函数 (list, has, get)
  - 执行函数 (execute)
  - 管理生命周期 (initialize, dispose)

Planner:
  - 查询可用函数
  - 生成执行计划

Executor:
  - 执行计划中的步骤
  - 调用 FunctionProvider.execute()
```

### 4. 测试友好
- Mock `FunctionProvider` 即可测试 Planner 和 Executor
- 各个 Provider 独立测试
- 集成测试使用 `CompositeFunctionProvider`

## 风险和注意事项

### 1. 破坏性变更
- 需要修改所有使用 `FunctionRegistry` 的代码
- **缓解**: 保留向后兼容绑定，逐步迁移

### 2. 性能影响
- `CompositeFunctionProvider` 需要遍历多个 Provider
- **缓解**:
  - 本地优先策略（99% 情况下第一次就找到）
  - 可选：添加缓存层

### 3. 复杂度增加
- 引入新的抽象层
- **缓解**:
  - 详细文档
  - 清晰的命名和职责划分

## 时间估算

- Phase 1: 2-3 天（创建新接口和实现）
- Phase 2: 1-2 天（重构 Planner 和 Executor）
- Phase 3: 0.5 天（更新容器配置）
- Phase 4: 1-2 天（清理和测试）

**总计**: 5-8 天

## 下一步行动

1. [ ] Review 这份重构计划，确认方向
2. [ ] 创建 feature branch: `feature/function-provider-refactor`
3. [ ] 实施 Phase 1.1-1.2（本地实现）
4. [ ] 编写单元测试验证
5. [ ] 继续后续 Phase
