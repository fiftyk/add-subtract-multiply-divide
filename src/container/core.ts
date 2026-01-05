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
import { SessionStorage } from '../services/storage/interfaces/SessionStorage.js';
import { SessionStorageImpl } from '../services/storage/SessionStorage.js';
import { Storage } from '../storage/interfaces/Storage.js';
import { StorageImpl } from '../storage/StorageImpl.js';
import { Executor } from '../executor/interfaces/Executor.js';
import { ExecutorImpl } from '../executor/implementations/ExecutorImpl.js';
import { LLMAdapter } from '../function-completion/interfaces/LLMAdapter.js';
import { AnthropicLLMAdapter } from '../function-completion/adapters/AnthropicLLMAdapter.js';
import { CLILLMAdapter } from '../function-completion/adapters/CLILLMAdapter.js';
import { MockServiceFactory } from '../function-completion/factory/MockServiceFactory.js';
import { MockServiceFactoryImpl } from '../function-completion/factory/MockServiceFactoryImpl.js';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { LocalFunctionProvider } from '../function-provider/LocalFunctionProvider.js';
import { CompositeFunctionProvider } from '../function-provider/CompositeFunctionProvider.js';
import { LocalFunctionProviderSymbol, RemoteFunctionProviderSymbol } from '../function-provider/symbols.js';
import { MCPFunctionProvider } from '../function-provider/implementations/MCPFunctionProvider.js';
import { MCPClient } from '../function-provider/transports/MCPClient.js';

/**
 * 注册核心服务绑定（跨端共享）
 */
export function registerCoreBindings(container: Container): void {
  // ============================================
  // FunctionProvider - 统一的函数发现和执行接口
  // ============================================
  container.bind(LocalFunctionProviderSymbol).to(LocalFunctionProvider);

  // MCPFunctionProvider - 动态创建（根据 MCP 配置）
  container.bind(MCPFunctionProvider).toDynamicValue(() => {
    const config = ConfigManager.get();
    
    // 没有配置服务器时使用默认配置
    const serverConfig = config.mcp.servers[0] ?? {
      name: 'noop',
      type: 'stdio' as const,
      command: 'echo',
      args: [],
    };

    const mcpConfig = {
      name: serverConfig.name,
      transportType: serverConfig.type,
      transportConfig: serverConfig,
    };

    const client = new MCPClient(mcpConfig);
    return new MCPFunctionProvider(client);
  });

  // RemoteFunctionProviderSymbol - 指向 MCPFunctionProvider
  container.bind(RemoteFunctionProviderSymbol).toService(MCPFunctionProvider);

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

  container.bind<SessionStorage>(SessionStorage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new SessionStorageImpl(config.storage.dataDir);
  });

  // ============================================
  // Executor
  // ============================================
  container.bind<Executor>(Executor).to(ExecutorImpl);

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
