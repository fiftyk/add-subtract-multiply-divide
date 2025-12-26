import 'reflect-metadata';
import { Container } from 'inversify';
import { FunctionRegistry } from './registry/interfaces/FunctionRegistry.js';
import { LocalFunctionRegistry } from './registry/LocalFunctionRegistry.js';
import { ToolProvider } from './tools/interfaces/ToolProvider.js';
import { ToolSelector } from './tools/interfaces/ToolSelector.js';
import { ToolFormatter } from './tools/interfaces/ToolFormatter.js';
import { LocalFunctionToolProvider } from './tools/LocalFunctionToolProvider.js';
import { AllToolsSelector } from './tools/AllToolsSelector.js';
import { StandardToolFormatter } from './tools/ToolFormatter.js';
import { CompositeToolProvider } from './tools/CompositeToolProvider.js';
import { LocalToolProviderSymbol, RemoteToolProviderSymbol } from './tools/providerSymbols.js';
import { PlannerLLMClient } from './planner/interfaces/PlannerLLMClient.js';
import { AnthropicPlannerLLMClient } from './planner/adapters/AnthropicPlannerLLMClient.js';
import { CLIPlannerLLMClient } from './planner/adapters/CLIPlannerLLMClient.js';
import { PlannerImpl } from './planner/planner.js';
import { AnthropicPlanRefinementLLMClient } from './services/adapters/AnthropicPlanRefinementLLMClient.js';
import { ConfigManager } from './config/index.js';
import { Planner } from './planner/interfaces/IPlanner.js';
import { PlanRefinementLLMClient } from './services/interfaces/IPlanRefinementLLMClient.js';
import { SessionStorage } from './services/storage/interfaces/SessionStorage.js';
import { SessionStorageImpl } from './services/storage/SessionStorage.js';
import { Storage } from './storage/interfaces/Storage.js';
import { StorageImpl } from './storage/StorageImpl.js';
import { Executor } from './executor/interfaces/Executor.js';
import { ExecutorImpl } from './executor/executor.js';
import { UserInputProvider } from './user-input/interfaces/UserInputProvider.js';
import { CLIUserInputProvider } from './user-input/adapters/CLIUserInputProvider.js';
import { LLMAdapter } from './mock/interfaces/LLMAdapter.js';
import { AnthropicLLMAdapter } from './mock/adapters/AnthropicLLMAdapter.js';
import { CLILLMAdapter } from './mock/adapters/CLILLMAdapter.js';
import { MockServiceFactory } from './mock/factory/MockServiceFactory.js';
import { MockServiceFactoryImpl } from './mock/factory/MockServiceFactoryImpl.js';
import { RemoteFunctionRegistry, MCPClient, NoOpRemoteFunctionRegistry } from './mcp/index.js';
import { RemoteToolProvider } from './mcp/RemoteToolProvider.js';

const container = new Container({
    defaultScope: 'Singleton',
});

// FunctionRegistry - 绑定到本地实现类
container.bind(FunctionRegistry).to(LocalFunctionRegistry);

// ToolProvider - 默认使用 CompositeToolProvider（合并本地和远程工具）
// LocalFunctionToolProvider 和 RemoteToolProvider 通过独立 Symbol 注入到 CompositeToolProvider
// 绑定具体实现到独立 Symbol
container.bind<LocalFunctionToolProvider>(LocalToolProviderSymbol).to(LocalFunctionToolProvider);
container.bind<RemoteToolProvider>(RemoteToolProviderSymbol).to(RemoteToolProvider);

// ToolProvider - 绑定到 CompositeToolProvider（合并所有工具）
container.bind(ToolProvider).to(CompositeToolProvider);

// ToolSelector - 单例（默认使用 AllToolsSelector 策略）
container.bind<ToolSelector>(ToolSelector).to(AllToolsSelector);

// ToolFormatter - 单例
container.bind<ToolFormatter>(ToolFormatter).to(StandardToolFormatter);

// PlannerLLMClient - 根据配置选择实现
// 默认使用 Anthropic API，如果设置了 PLANNER_GENERATOR_CMD/ARGS 则使用 CLI
container.bind(PlannerLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
    const { command, args } = config.plannerGenerator;

    if (command && args) {
        // 使用 CLI 命令（如 claude-switcher, gemini 等）
        return new CLIPlannerLLMClient(command, args);
    }

    // 默认使用 Anthropic API
    return new AnthropicPlannerLLMClient({
        apiKey: config.api.apiKey,
        baseURL: config.api.baseURL,
        model: config.llm.model,
        maxTokens: config.llm.maxTokens,
    });
});

// Planner - PlannerImpl 实现（依赖注入，自动注入 ToolProvider, ToolSelector, ToolFormatter, PlannerLLMClient）
container.bind(Planner).to(PlannerImpl);

// PlanRefinementLLMClient - 动态创建（从 ConfigManager 获取配置）
container.bind(PlanRefinementLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new AnthropicPlanRefinementLLMClient({
        apiKey: config.api.apiKey,
        baseURL: config.api.baseURL,
        model: config.llm.model,
        maxTokens: config.llm.maxTokens,
    });
});

// Storage - StorageImpl 实现（从 ConfigManager 获取 dataDir）
container.bind(Storage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new StorageImpl(config.storage.dataDir);
});

// SessionStorage - SessionStorageImpl 实现（从 ConfigManager 获取 dataDir）
container.bind(SessionStorage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new SessionStorageImpl(config.storage.dataDir);
});

// UserInputProvider - CLIUserInputProvider 实现（单例）
container.bind(UserInputProvider).to(CLIUserInputProvider);

// Executor - ExecutorImpl 实现（依赖注入，自动注入 FunctionRegistry 和 UserInputProvider）
container.bind(Executor).to(ExecutorImpl);

// LLMAdapter - 根据配置选择实现
// 默认使用 Anthropic API，如果设置了 MOCK_GENERATOR_CMD 则使用 CLI
container.bind(LLMAdapter).toDynamicValue(() => {
    const config = ConfigManager.get();
    const { command, args } = config.mockCodeGenerator;

    if (command && args) {
        // 使用 CLI 命令（如 claude-switcher, gemini 等）
        return new CLILLMAdapter(command, args);
    }

    // 默认使用 Anthropic API
    return new AnthropicLLMAdapter(
        config.api.apiKey,
        config.api.baseURL
    );
});

// MockServiceFactory - 单例（依赖注入 LLMAdapter, Storage, FunctionRegistry）
container.bind(MockServiceFactory).to(MockServiceFactoryImpl);

// RemoteFunctionRegistry - 动态创建（根据 MCP 配置）
// 没有配置服务器时使用 NoOp 实现
container.bind<RemoteFunctionRegistry>(RemoteFunctionRegistry).toDynamicValue(() => {
    const config = ConfigManager.get();

    // 没有配置服务器时使用 NoOp 实现
    if (config.mcp.servers.length === 0) {
        return new NoOpRemoteFunctionRegistry();
    }

    // 使用第一个配置的服务器
    const serverConfig = config.mcp.servers[0];
    const mcpConfig = {
        name: serverConfig.name,
        transportType: serverConfig.type,
        transportConfig: serverConfig,
    };

    return new MCPClient(mcpConfig);
});

// RemoteToolProvider - 可选绑定（向后兼容）
// 使用 @optional() 装饰器的消费者在 MCP 未启用时会接收 undefined
container.bind<RemoteToolProvider>(RemoteToolProvider).to(RemoteToolProvider);

export { container, MockServiceFactory };
export default container;
