import 'reflect-metadata';
import { Container } from 'inversify';
import { FunctionRegistry } from './registry/index.js';
import { ToolProvider } from './tools/interfaces/ToolProvider.js';
import { ToolSelector } from './tools/interfaces/ToolSelector.js';
import { ToolFormatter } from './tools/interfaces/ToolFormatter.js';
import { LocalFunctionToolProvider } from './tools/LocalFunctionToolProvider.js';
import { AllToolsSelector } from './tools/AllToolsSelector.js';
import { StandardToolFormatter } from './tools/ToolFormatter.js';
import { PlannerLLMClient } from './planner/interfaces/IPlannerLLMClient.js';
import { AnthropicPlannerLLMClient } from './planner/adapters/AnthropicPlannerLLMClient.js';
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
import { ClaudeCodeLLMAdapter } from './mock/adapters/ClaudeCodeLLMAdapter.js';
import { MockServiceFactory } from './mock/factory/MockServiceFactory.js';
import { MockServiceFactoryImpl } from './mock/factory/MockServiceFactoryImpl.js';

const container = new Container({
    defaultScope: 'Singleton',
});

// FunctionRegistry - 单例（确保整个应用共享同一个实例）
container.bind(FunctionRegistry).toSelf();

// ToolProvider - 单例（依赖同一个 FunctionRegistry 实例）
container.bind<ToolProvider>(ToolProvider).to(LocalFunctionToolProvider);

// ToolSelector - 单例（默认使用 AllToolsSelector 策略）
container.bind<ToolSelector>(ToolSelector).to(AllToolsSelector);

// ToolFormatter - 单例
container.bind<ToolFormatter>(ToolFormatter).to(StandardToolFormatter);

// PlannerLLMClient - 动态创建（从 ConfigManager 获取配置）
container.bind(PlannerLLMClient).toDynamicValue(() => {
    const config = ConfigManager.get();
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

// LLMAdapter - 根据配置选择实现（anthropic 或 claude-code）
container.bind(LLMAdapter).toDynamicValue(() => {
    const config = ConfigManager.get();
    if (config.llm.adapter === 'claude-code') {
        return new ClaudeCodeLLMAdapter();
    }
    return new AnthropicLLMAdapter(
        config.api.apiKey,
        config.api.baseURL
    );
});

// MockServiceFactory - 单例（依赖注入 LLMAdapter, Storage, FunctionRegistry）
container.bind(MockServiceFactory).to(MockServiceFactoryImpl);

export { container, MockServiceFactory };
export default container;
