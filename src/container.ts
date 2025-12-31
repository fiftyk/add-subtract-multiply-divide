import 'reflect-metadata';
import { Container } from 'inversify';
import { ToolSelector } from './tools/interfaces/ToolSelector.js';
import { ToolFormatter } from './tools/interfaces/ToolFormatter.js';
import { AllToolsSelector } from './tools/AllToolsSelector.js';
import { StandardToolFormatter } from './tools/ToolFormatter.js';
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
import { ExecutorImpl } from './executor/implementations/ExecutorImpl.js';
import { UserInputProvider } from './user-input/interfaces/UserInputProvider.js';
import { CLIUserInputProvider } from './user-input/adapters/CLIUserInputProvider.js';
import { LLMAdapter } from './function-completion/interfaces/LLMAdapter.js';
import { AnthropicLLMAdapter } from './function-completion/adapters/AnthropicLLMAdapter.js';
import { CLILLMAdapter } from './function-completion/adapters/CLILLMAdapter.js';
import { MockServiceFactory } from './function-completion/factory/MockServiceFactory.js';
import { MockServiceFactoryImpl } from './function-completion/factory/MockServiceFactoryImpl.js';
import { FunctionProvider } from './function-provider/interfaces/FunctionProvider.js';
import { LocalFunctionProvider } from './function-provider/LocalFunctionProvider.js';
import { CompositeFunctionProvider } from './function-provider/CompositeFunctionProvider.js';
import { LocalFunctionProviderSymbol, RemoteFunctionProviderSymbol } from './function-provider/symbols.js';
import { MCPFunctionProvider } from './function-provider/implementations/MCPFunctionProvider.js';
import { MCPClient } from './function-provider/transports/MCPClient.js';

const container = new Container({
    defaultScope: 'Singleton',
});

// ============================================
// FunctionProvider - 统一的函数发现和执行接口
// ============================================
// LocalFunctionProvider - 本地函数提供者（用于依赖注入）
container.bind(LocalFunctionProviderSymbol).to(LocalFunctionProvider);

// MCPFunctionProvider - 动态创建（根据 MCP 配置）
// 内部会创建 MCPClient，无需单独绑定 RemoteFunctionRegistry
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

// RemoteFunctionProviderSymbol - 指向 MCPFunctionProvider（用于需要远程函数的场景）
container.bind(RemoteFunctionProviderSymbol).toService(MCPFunctionProvider);

// CompositeFunctionProvider - 组合本地和远程函数提供者
container.bind(FunctionProvider).to(CompositeFunctionProvider);

// ============================================
// ToolSelector - 单例（默认使用 AllToolsSelector 策略）
// ============================================
container.bind<ToolSelector>(ToolSelector).to(AllToolsSelector);

// ============================================
// ToolFormatter - 单例
// ============================================
container.bind<ToolFormatter>(ToolFormatter).to(StandardToolFormatter);

// ============================================
// PlannerLLMClient - 根据配置选择实现
// ============================================
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

// ============================================
// Planner - PlannerImpl 实现
// ============================================
container.bind(Planner).to(PlannerImpl);

// ============================================
// PlanRefinementLLMClient - 动态创建
// ============================================
container.bind(PlanRefinementLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new AnthropicPlanRefinementLLMClient({
        apiKey: config.api.apiKey,
        baseURL: config.api.baseURL,
        model: config.llm.model,
        maxTokens: config.llm.maxTokens,
    });
});

// ============================================
// Storage - StorageImpl 实现
// ============================================
container.bind(Storage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new StorageImpl(config.storage.dataDir);
});

// ============================================
// SessionStorage - SessionStorageImpl 实现
// ============================================
container.bind(SessionStorage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new SessionStorageImpl(config.storage.dataDir);
});

// ============================================
// UserInputProvider - CLIUserInputProvider 实现
// ============================================
container.bind(UserInputProvider).to(CLIUserInputProvider);

// ============================================
// Executor - ExecutorImpl 实现
// ============================================
container.bind(Executor).to(ExecutorImpl);

// ============================================
// LLMAdapter - 根据配置选择实现
// ============================================
container.bind(LLMAdapter).toDynamicValue(() => {
    const config = ConfigManager.get();
    const { command, args } = config.functionCodeGenerator;

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

// ============================================
// MockServiceFactory - 单例
// ============================================
container.bind(MockServiceFactory).to(MockServiceFactoryImpl);

export { container, MockServiceFactory };
export default container;
