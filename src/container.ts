import 'reflect-metadata';
import { Container } from 'inversify';
import { FunctionRegistry } from './registry/index.js';
import { ToolProvider } from './remote/interfaces/tool-provider.js';
import { LocalFunctionToolProvider } from './remote/implementations/LocalFunctionToolProvider.js';
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

const container = new Container({
    defaultScope: 'Singleton',
});

// FunctionRegistry - 单例（确保整个应用共享同一个实例）
container.bind(FunctionRegistry).toSelf();

// ToolProvider - 单例（依赖同一个 FunctionRegistry 实例）
container.bind<ToolProvider>(ToolProvider).to(LocalFunctionToolProvider);

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

// Planner - PlannerImpl 实现（依赖注入，自动注入 ToolProvider, FunctionRegistry, PlannerLLMClient）
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

export { container };
export default container;
