/**
 * Core Bindings - 跨端共享的服务绑定
 * 
 * 这些服务在 CLI 和 Web 端都相同
 */

import type { Container } from 'inversify';
import { ToolSelector } from '../tools/interfaces/ToolSelector.js';
import { ToolFormatter } from '../tools/interfaces/ToolFormatter.js';
import { AllToolsSelector } from '../tools/AllToolsSelector.js';
import { StandardToolFormatter } from '../tools/ToolFormatter.js';
import { PlannerLLMClient } from '../planner/interfaces/PlannerLLMClient.js';
import { AnthropicPlannerLLMClient } from '../planner/adapters/AnthropicPlannerLLMClient.js';
import { CLIPlannerLLMClient } from '../planner/adapters/CLIPlannerLLMClient.js';
import { PlannerImpl } from '../planner/planner.js';
import { AnthropicPlanRefinementLLMClient } from '../services/adapters/AnthropicPlanRefinementLLMClient.js';
import { ConfigManager } from '../config/index.js';
import { Planner } from '../planner/interfaces/IPlanner.js';
import { PlanRefinementLLMClient } from '../services/interfaces/IPlanRefinementLLMClient.js';
import { PlanRefinementSessionStorage } from '../services/storage/interfaces/PlanRefinementSessionStorage.js';
import { PlanRefinementSessionStorageImpl } from '../services/storage/PlanRefinementSessionStorage.js';
import { Storage } from '../storage/interfaces/Storage.js';
import { StorageImpl } from '../storage/StorageImpl.js';
import { Executor } from '../executor/interfaces/Executor.js';
import { ConditionalExecutor } from '../executor/implementations/ConditionalExecutor.js';
import { TimeoutStrategy } from '../executor/interfaces/TimeoutStrategy.js';
import { NoTimeoutStrategy } from '../executor/implementations/NoTimeoutStrategy.js';
import { ExecutionSessionStorage } from '../executor/session/interfaces/ExecutionSessionStorage.js';
import { ExecutionSessionStorageImpl } from '../executor/session/storage/ExecutionSessionStorageImpl.js';
import { ExecutionSessionManager } from '../executor/session/interfaces/ExecutionSessionManager.js';
import { ExecutionSessionManagerImpl } from '../executor/session/managers/ExecutionSessionManagerImpl.js';
import { LLMAdapter } from '../function-completion/interfaces/LLMAdapter.js';
import { AnthropicLLMAdapter } from '../function-completion/adapters/AnthropicLLMAdapter.js';
import { CLILLMAdapter } from '../function-completion/adapters/CLILLMAdapter.js';
import { MockServiceFactory } from '../function-completion/factory/MockServiceFactory.js';
import { MockServiceFactoryImpl } from '../function-completion/factory/MockServiceFactoryImpl.js';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { LocalFunctionProvider } from '../function-provider/LocalFunctionProvider.js';
import { CompositeFunctionProvider } from '../function-provider/CompositeFunctionProvider.js';
import { LocalFunctionProviderSymbol, RemoteFunctionProviderSymbol, AllRemoteFunctionProvidersSymbol } from '../function-provider/symbols.js';
import { MCPFunctionProvider } from '../function-provider/implementations/MCPFunctionProvider.js';
import { MCPClient } from '../function-provider/transports/MCPClient.js';
import { MCPServerConfigProvider } from '../mcp/interfaces/MCPServerConfigProvider.js';
import { MCPServerConfigProviderImpl } from '../mcp/MCPServerConfigProviderImpl.js';
import type { MCPServerConfig } from '../config/types.js';

/**
 * 注册核心服务绑定（跨端共享）
 */
export function registerCoreBindings(container: Container): void {
  // ============================================
  // MCPServerConfigProvider - MCP 配置管理
  // ============================================
  container.bind(MCPServerConfigProvider).to(MCPServerConfigProviderImpl);

  // ============================================
  // FunctionProvider - 统一的函数发现和执行接口
  // ============================================
  container.bind(LocalFunctionProviderSymbol).to(LocalFunctionProvider);

  // MCPFunctionProvider - 动态创建（根据 MCP 配置）
  // 向后兼容：使用第一个配置的 server
  container.bind(MCPFunctionProvider).toDynamicValue(() => {
    const mcpConfig = container.get<MCPServerConfigProvider>(MCPServerConfigProvider);
    const servers = mcpConfig.getServers();

    // 没有配置服务器时使用默认配置
    const serverConfig = servers[0] ?? {
      name: 'noop',
      type: 'stdio' as const,
      command: 'echo',
      args: [],
    };

    const config = {
      name: serverConfig.name,
      transportType: serverConfig.type,
      transportConfig: serverConfig,
    };

    const client = new MCPClient(config);
    return new MCPFunctionProvider(client);
  });

  // RemoteFunctionProviderSymbol - 指向 MCPFunctionProvider（向后兼容）
  container.bind(RemoteFunctionProviderSymbol).toService(MCPFunctionProvider);

  // AllRemoteFunctionProvidersSymbol - 为每个配置的 MCP server 创建 provider
  container.bind(AllRemoteFunctionProvidersSymbol).toDynamicValue(() => {
    const mcpConfig = container.get<MCPServerConfigProvider>(MCPServerConfigProvider);

    // 如果 MCP 未启用或没有配置 servers，返回空数组
    if (!mcpConfig.isEnabled() || mcpConfig.getServers().length === 0) {
      return [];
    }

    // 为每个 server 创建 MCPFunctionProvider
    return mcpConfig.getServers().map((serverConfig: MCPServerConfig) => {
      const config = {
        name: serverConfig.name,
        transportType: serverConfig.type,
        transportConfig: serverConfig,
      };
      const client = new MCPClient(config);
      return new MCPFunctionProvider(client);
    });
  });

  // CompositeFunctionProvider - 组合本地和远程函数提供者
  container.bind(FunctionProvider).to(CompositeFunctionProvider);

  // ============================================
  // Tools - 工具选择器和格式化器
  // ============================================
  container.bind<ToolSelector>(ToolSelector).to(AllToolsSelector);
  container.bind<ToolFormatter>(ToolFormatter).to(StandardToolFormatter);

  // ============================================
  // PlannerLLMClient - 根据配置选择实现
  // ============================================
  container.bind<PlannerLLMClient>(PlannerLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
    const { command, args } = config.plannerGenerator;

    if (command && args) {
      return new CLIPlannerLLMClient(command, args);
    }

    return new AnthropicPlannerLLMClient({
      apiKey: config.api.apiKey,
      baseURL: config.api.baseURL,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
    });
  });

  container.bind<Planner>(Planner).to(PlannerImpl);

  // ============================================
  // PlanRefinementLLMClient
  // ============================================
  container.bind<PlanRefinementLLMClient>(PlanRefinementLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new AnthropicPlanRefinementLLMClient({
      apiKey: config.api.apiKey,
      baseURL: config.api.baseURL,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
    });
  });

  // ============================================
  // Storage
  // ============================================
  container.bind<Storage>(Storage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new StorageImpl(config.storage.dataDir);
  });

  container.bind<PlanRefinementSessionStorage>(PlanRefinementSessionStorage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new PlanRefinementSessionStorageImpl(config.storage.dataDir);
  });

  // ============================================
  // Executor - 使用 ConditionalExecutor 支持条件分支
  // ============================================
  container.bind(Executor).to(ConditionalExecutor);

  // ============================================
  // TimeoutStrategy - Default: NoTimeoutStrategy
  // ============================================
  container.bind(TimeoutStrategy).to(NoTimeoutStrategy);

  // ============================================
  // ExecutionSessionStorage - File-based persistent storage
  // ============================================
  container.bind(ExecutionSessionStorage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new ExecutionSessionStorageImpl(config.storage.dataDir);
  });

  // ============================================
  // ExecutionSessionManager - Session lifecycle management
  // ============================================
  container.bind(ExecutionSessionManager).to(ExecutionSessionManagerImpl);

  // ============================================
  // LLMAdapter - 根据配置选择实现
  // ============================================
  container.bind<LLMAdapter>(LLMAdapter).toDynamicValue(() => {
    const config = ConfigManager.get();
    const { command, args } = config.functionCodeGenerator;
    if (command && args) {
      return new CLILLMAdapter(command, args);
    }
    return new AnthropicLLMAdapter(
      config.api.apiKey,
      config.api.baseURL
    );
  });

  // ============================================
  // MockServiceFactory
  // ============================================
  container.bind<MockServiceFactory>(MockServiceFactory).to(MockServiceFactoryImpl);
}
