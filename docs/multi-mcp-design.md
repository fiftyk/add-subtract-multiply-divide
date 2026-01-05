# 多 MCP Servers 支持 - 设计文档

## 目标
支持同时配置和使用多个 MCP servers，让用户可以同时访问来自不同服务器的工具。

## 当前架构问题

### 1. 配置层 - ✅ 已支持
```typescript
// src/config/types.ts
interface MCPConfig {
  enabled: boolean;
  servers: MCPServerConfig[];  // 👈 已经是数组
}
```

### 2. 容器绑定层 - ❌ 只用第一个
```typescript
// src/container/core.ts:48-67
container.bind(MCPFunctionProvider).toDynamicValue(() => {
  const config = ConfigManager.get();
  const serverConfig = config.mcp.servers[0] ?? { ... };  // 👈 问题：只用第一个
  // ...
});
```

### 3. 组合层 - ⚠️ 需要改进
```typescript
// CompositeFunctionProvider 构造函数
constructor(
  localProvider?: LocalFunctionProvider,
  remoteProvider?: MCPFunctionProvider,  // 👈 问题：只接受单个
  config?: CompositeFunctionProviderConfig
)
```

## 解决方案

### 方案：工厂函数 + Symbol 数组

#### 步骤 1：添加新的 Symbol
```typescript
// src/function-provider/symbols.ts
export const AllRemoteFunctionProvidersSymbol = Symbol('AllRemoteFunctionProviders');
```

#### 步骤 2：修改容器绑定
```typescript
// src/container/core.ts
container.bind(AllRemoteFunctionProvidersSymbol).toDynamicValue(() => {
  const config = ConfigManager.get();

  if (!config.mcp.enabled || config.mcp.servers.length === 0) {
    return [];
  }

  // 为每个 server 创建 MCPFunctionProvider
  return config.mcp.servers.map(serverConfig => {
    const mcpConfig = {
      name: serverConfig.name,
      transportType: serverConfig.type,
      transportConfig: serverConfig,
    };
    const client = new MCPClient(mcpConfig);
    return new MCPFunctionProvider(client);
  });
});
```

#### 步骤 3：修改 CompositeFunctionProvider
```typescript
// 方案 A：使用 multiInject（推荐）
constructor(
  @inject(LocalFunctionProviderSymbol) @optional() localProvider?: LocalFunctionProvider,
  @multiInject(AllRemoteFunctionProvidersSymbol) @optional() remoteProviders?: MCPFunctionProvider[],
  @unmanaged() config?: CompositeFunctionProviderConfig
) {
  this.providers = [];
  if (localProvider) {
    this.providers.push(localProvider);
  }
  if (remoteProviders && remoteProviders.length > 0) {
    this.providers.push(...remoteProviders);
  }
}
```

## 优先级和冲突处理

### 函数查找顺序
1. 本地函数（LocalFunctionProvider）
2. MCP Servers（按配置顺序）

### 冲突解决策略
当多个 provider 提供同名函数时：
- **默认策略**：`first-wins` - 使用第一个找到的
- **可配置**：通过 `CompositeFunctionProviderConfig.resolutionStrategy`

## 测试计划

### 单元测试
- [ ] 空配置：无 MCP servers
- [ ] 单服务器：兼容性测试
- [ ] 多服务器：2-3 个服务器
- [ ] 函数冲突：同名函数的解决策略
- [ ] 错误处理：某个服务器连接失败

### E2E 测试
- [ ] CLI 测试：同时使用文件系统 + HTTP 服务器
- [ ] 执行测试：跨服务器的函数调用

## 文档更新

### CLAUDE.md
- [ ] 更新配置说明：如何配置多个 servers
- [ ] 添加示例：常见的多服务器场景
- [ ] 说明优先级规则

### 用户文档
- [ ] 配置示例：.env 和 programmatic config
- [ ] 故障排查：多服务器常见问题

## 风险和限制

### 已知限制
1. ⚠️ 所有 MCP servers 在启动时连接（可能较慢）
2. ⚠️ 任一服务器故障不影响其他服务器（已处理）
3. ⚠️ 函数名冲突时默认选第一个（已文档化）

### 未来改进
- [ ] 延迟加载：按需连接 MCP servers
- [ ] 健康检查：定期检测服务器状态
- [ ] 智能路由：基于函数使用统计优化查找顺序
