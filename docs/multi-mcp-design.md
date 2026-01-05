# 多 MCP Servers 支持 - 设计文档

## ✅ 实现完成

该功能已完全实现并通过所有测试。

## 实现方案

### 架构设计

**1. 配置层 - ✅ 已实现**

创建了专门的 `MCPServerConfigProvider` 接口和实现：
- 职责：加载和管理 MCP servers 配置
- 配置文件：`fn-orchestrator.mcp.json`（项目根目录）
- 分离关注点：不再通过 `ConfigManager` 管理 MCP 配置

```typescript
// src/mcp/interfaces/MCPServerConfigProvider.ts
export interface MCPServerConfigProvider {
  getServers(): MCPServerConfig[];
  isEnabled(): boolean;
  reload(): void;
}
```

**2. 容器绑定层 - ✅ 已实现**

```typescript
// src/container/core.ts
container.bind(MCPServerConfigProvider).to(MCPServerConfigProviderImpl);

container.bind(AllRemoteFunctionProvidersSymbol).toDynamicValue(() => {
  const mcpConfig = container.get<MCPServerConfigProvider>(MCPServerConfigProvider);

  if (!mcpConfig.isEnabled() || mcpConfig.getServers().length === 0) {
    return [];
  }

  return mcpConfig.getServers().map(serverConfig => {
    const config = {
      name: serverConfig.name,
      transportType: serverConfig.type,
      transportConfig: serverConfig,
    };
    const client = new MCPClient(config);
    return new MCPFunctionProvider(client);
  });
});
```

**3. 组合层 - ✅ 已实现**

```typescript
// CompositeFunctionProvider 构造函数
constructor(
  @inject(LocalFunctionProviderSymbol) @optional() localProvider?: LocalFunctionProvider | FunctionProvider[],
  @multiInject(AllRemoteFunctionProvidersSymbol) @optional() remoteProviders?: MCPFunctionProvider[],
  @unmanaged() config?: CompositeFunctionProviderConfig
)
```

## 配置示例

### fn-orchestrator.mcp.json

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "filesystem",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    {
      "name": "github",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    {
      "name": "custom-http-server",
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "accessToken": "optional-token"
    }
  ]
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

## 测试结果

✅ 所有 416 个单元测试通过
- 空配置：无 MCP servers
- 单服务器：兼容性测试
- 多服务器：2-3 个服务器
- 向后兼容：现有代码无需修改

## 设计优势

1. **单一职责原则**
   - `ConfigManager`: 管理应用配置
   - `MCPServerConfigProvider`: 管理 MCP 配置

2. **依赖倒置**
   - 容器绑定依赖接口而非具体实现
   - 更易于测试和扩展

3. **向后兼容**
   - 保留 `RemoteFunctionProviderSymbol` 用于单服务器场景
   - 添加 `AllRemoteFunctionProvidersSymbol` 用于多服务器场景

4. **配置清晰**
   - JSON 格式易于阅读和编辑
   - 支持注释和结构化配置
   - 独立文件避免与环境变量混淆
