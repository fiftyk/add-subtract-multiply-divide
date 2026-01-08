# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# fn-orchestrator - 基于 LLM 的函数编排系统

这是一个使用 Claude API 将自然语言需求转换为可执行函数调用链的 TypeScript 项目。

## 常用命令

### 构建和测试
```bash
# 构建项目
npm run build

# 运行所有测试（watch 模式）
npm test

# 运行单次测试
npm run test:run

# 类型检查
npx tsc --noEmit

# 开发模式（使用 tsx，不需要构建）
npm run dev -- plan "计算 3 + 5"
```

### CLI 命令
```bash
# 生成执行计划
npx fn-orchestrator plan "计算 (3 + 5) * 2"
npx fn-orchestrator plan "需求描述" --auto-complete  # 启用函数自动补全

# 执行计划
npx fn-orchestrator execute plan-abc123
npx fn-orchestrator execute plan-abc123 -y  # 跳过确认

# 管理执行会话
npx fn-orchestrator sessions list              # 列出所有会话
npx fn-orchestrator sessions list --plan plan-abc123  # 按 plan 过滤
npx fn-orchestrator sessions list --status failed     # 按状态过滤
npx fn-orchestrator sessions show session-abc  # 查看会话详情
npx fn-orchestrator sessions retry session-abc # 重试失败的会话
npx fn-orchestrator sessions retry session-abc --from-step 2  # 从指定步骤重试
npx fn-orchestrator sessions delete session-abc # 删除会话
npx fn-orchestrator sessions stats plan-abc123  # 查看执行统计

# 查看函数和计划
npx fn-orchestrator list functions
npx fn-orchestrator list plans
npx fn-orchestrator show-plan plan-abc123
```

## 核心架构

### 系统流程
```
用户需求(自然语言) → Planner(LLM) → ExecutionPlan(JSON) → 用户确认 → Executor → 结果
```

### 关键模块及其职责

**ConfigManager (单例模式)**
- CLI 启动时通过 `preAction` hook 初始化（`src/cli/index.ts:17-30`）
- 配置优先级：CLI 参数 > 环境变量 > .env 文件 > 默认值
- 所有业务代码通过 `ConfigManager.get()` 获取配置
- 测试中使用 `ConfigManager.reset()` 重置状态

**FunctionRegistry**
- 管理函数的注册、查询和执行
- 使用 `defineFunction()` 定义函数，包含 name、description、parameters、returns、implementation
- 支持同步和异步函数

**Planner**
- 调用 Claude API 将自然语言转换为 `ExecutionPlan`
- 通过 `PlannerLLMClient` 接口与 LLM 交互（依赖注入）
- 识别缺失函数并返回 `missingFunctions` 列表

**PlannerWithMockSupport (装饰器模式)**
- 装饰 `Planner`，添加自动 函数补全功能
- 检测到缺失函数时，调用 `CompletionOrchestratorImpl` 生成 函数实现
- 支持迭代生成（默认最多 3 次），直到计划完整或达到上限
- 遵循 OCP 原则：扩展功能但不修改原始 Planner 代码

**CompletionOrchestratorImpl**
- 协调 4 个组件完成 函数补全工作流：
  - `FunctionCodeGenerator`: 使用 LLM 生成 TypeScript 代码
  - `FunctionFileWriter`: 保存到 `.data/plans/{planId}/mocks/` 目录
  - `FunctionLoader`: 动态加载并注册函数到 registry
  - `CompletionMetadataProvider`: 管理 补全元数据（标记为补全函数）

**LLMAdapter (代码生成器接口)**
- 抽象 LLM 调用层，支持切换不同 provider
- 接口方法：`generateCode(prompt: string): Promise<string>`
- 实现类：
  - `AnthropicLLMAdapter`: Anthropic API 调用
  - `CLILLMAdapter`: CLI 命令调用（如 claude-switcher, gemini 等）

**MockServiceFactory (工厂模式)**
- 接口 + 实现类分离（符合 InversifyJS 规范）
- `MockServiceFactory`: 接口，定义 `createOrchestrator(planId)` 方法
- `MockServiceFactoryImpl`: 实现类，使用 `@injectable` 装饰器
- 通过容器注入 `LLMAdapter`、`Storage`、`FunctionRegistry` 依赖

**Executor**
- 顺序执行计划中的步骤
- 使用 `ExecutionContext` 解析步骤间的数据引用（如 `${step.1.result}`）
- 支持超时控制（`stepTimeout`），默认 30 秒
- 记录详细的执行日志（通过 `ILogger`）

**ExecutionSessionStorage & ExecutionSessionManager**
- **ExecutionSessionStorage**: 管理执行会话的持久化存储
  - 保存/加载/更新/删除会话
  - 按 plan、状态、平台过滤查询
  - 统计分析（成功率、平均时长等）
  - 数据存储：`.data/execution-sessions/` 目录
- **ExecutionSessionManager**: 管理会话生命周期
  - `createSession()`: 创建新会话（每次执行创建独立会话）
  - `executeSession()`: 执行会话
  - `retrySession()`: 重试失败的会话（可从指定步骤开始）
  - `resumeSession()`: 恢复等待用户输入的会话
  - `cancelSession()`: 取消运行中的会话

**ExecutionSession 类型**
```typescript
interface ExecutionSession {
  id: string;              // session-{uuid}
  planId: string;          // plan-abc 或 plan-abc-v2
  basePlanId: string;      // plan-abc (不含版本号)
  planVersion?: number;    // 版本号
  status: ExecutionStatus; // pending | running | waiting_input | completed | failed
  result?: ExecutionResult; // 执行完成后填充
  parentSessionId?: string; // 重试时指向父会话
  retryCount: number;       // 重试次数
  platform: 'cli' | 'web';  // 执行平台
  createdAt: string;
  completedAt?: string;
  // ... 其他字段
}
```

**PlanRefinementSessionStorage (原 InteractionSession)**
- 管理 Plan 改进会话的持久化存储（refine 命令使用）
- 保存对话历史、当前版本等信息
- 数据存储：`.data/refinement-sessions/` 目录
- 与 ExecutionSession 分离，避免命名混淆

**Storage**
- 持久化计划到 `.data/` 目录（JSON 文件）
- Plans: `.data/plans/plan-{id}.json` 或 `.data/plans/plan-{id}-v{version}.json`
- ⚠️ **废弃方法**：`saveExecution()`, `loadExecution()`, `listExecutions()` 已废弃
- 使用 `ExecutionSessionManager` 代替旧的 execution 存储方式

### SOLID 设计原则应用

**单一职责 (SRP)**
- 每个模块只负责一件事：Registry 管理函数，Planner 规划，Executor 执行
- Function Completion 系统拆分为 5 个独立类，各司其职

**开闭原则 (OCP)**
- 使用装饰器模式扩展 Planner，不修改原有代码
- 通过依赖注入添加新功能（如 函数补全）

**里氏替换 (LSP)**
- 补全函数与真实函数使用相同的 `FunctionDefinition` 类型
- Executor 无需知道函数是否为补全函数

**接口隔离 (ISP)**
- 小而专注的接口，如 `PlannerLLMClient`、`FunctionCodeGenerator`
- Function Completion 系统有 6 个独立接口，每个 1-3 个方法

**依赖倒置 (DIP)**
- 所有类依赖抽象接口，不依赖具体实现
- 通过构造函数注入依赖（Planner 注入 LLM client，Executor 注入 Registry）

## InversifyJS 容器使用规范

### 接口与实现命名约定
```
src/
└── storage/
    ├── interfaces/
    │   └── Storage.ts      # 接口 + Symbol (一行导出)
    └── StorageImpl.ts      # 实现类 (添加 @injectable)
```

**命名规则：**
- 接口文件名：与接口名相同，不使用 `I` 前缀
- 接口名：`Storage`
- Symbol：`SessionStorage = Symbol('SessionStorage')`（与接口同名）
- 实现类名：`SessionStorageImpl`（添加 `Impl` 后缀）
- 文件名：`StorageImpl.ts`

### 接口文件导出模式
```typescript
// src/storage/interfaces/Storage.ts
import type { ExecutionPlan } from '../../planner/types.js';

export interface Storage {
  savePlan(plan: ExecutionPlan): Promise<void>;
  loadPlan(planId: string): Promise<ExecutionPlan | undefined>;
}

export const Storage = Symbol('Storage');
```

### 同名接口与 Symbol 导入方式
当接口和 Symbol 同名时，可以一行导入两者（TypeScript 会正确解析）：

```typescript
// 正确写法
import { Storage } from './storage/interfaces/Storage.js';

// 错误写法 - 会导致命名冲突
import type { Storage } from './storage/interfaces/Storage.js';
import { Storage } from './storage/interfaces/Storage.js';
```

在 InversifyJS 中，`@inject(Storage)` 会自动解析为 Symbol，不需要额外处理。

### 实现类模式
```typescript
// src/storage/StorageImpl.ts
import 'reflect-metadata';
import { injectable } from 'inversify';
import type { Storage } from './interfaces/Storage.js';

@injectable()
export class StorageImpl implements Storage {
  constructor(private dataDir: string = '.data') {}
  // 实现...
}
```

### 容器绑定模式
```typescript
// src/container.ts
import { Storage } from './storage/interfaces/Storage.js';
import { StorageImpl } from './storage/StorageImpl.js';

// 简单绑定（无额外依赖）
container.bind(Executor).to(ExecutorImpl);

// 动态值绑定（需要运行时配置）
container.bind(Storage).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new StorageImpl(config.storage.dataDir);
});

// 依赖注入绑定（自动解析依赖）
container.bind(Planner).to(PlannerImpl);
```

### 从容器获取实例
```typescript
// CLI 命令中
import container from '../../container.js';
import { Storage, Executor } from '../services/index.js';

const storage = container.get<Storage>(Storage);
const executor = container.get<Executor>(Executor);
```

### 测试中使用实现类
测试直接实例化实现类，不需要通过容器：
```typescript
import { SessionStorageImpl } from '../storage/SessionStorage.js';
import type { SessionStorage } from '../storage/interfaces/SessionStorage.js';

describe('SessionStorage', () => {
  let storage: SessionStorage;
  beforeEach(() => {
    storage = new SessionStorageImpl(testDataDir);
  });
});
```

## 重要代码约定

### ConfigManager 使用规范
- **CLI 层** (`src/cli/index.ts`)：通过 `preAction` hook 初始化一次
- **业务层**：始终使用 `ConfigManager.get()` 获取配置，不要直接调用 `loadConfig()`
- **测试**：每个测试前调用 `ConfigManager.reset()` 清理状态

### 命令退出处理
所有 CLI 命令必须显式调用 `process.exit()`：
- 成功时：`process.exit(0)`
- 失败时：`process.exit(1)`
- 原因：`inquirer` 库不会自动释放资源，导致进程挂起

### 测试编写规范
- 使用 Vitest 框架
- 测试文件位于 `src/*/__tests__/` 或 `__tests__/` (E2E)
- 配置相关测试需要设置/清理环境变量
- E2E 测试需要构建项目 (`npm run build`)

### 定义函数
```typescript
import { defineFunction } from '../src/registry/index.js';

export const myFunction = defineFunction({
  name: 'myFunction',
  description: '函数功能描述',
  scenario: '使用场景说明',  // 帮助 LLM 理解何时使用
  parameters: [
    { name: 'x', type: 'number', description: '参数说明' }
  ],
  returns: { type: 'number', description: '返回值说明' },
  implementation: (x: number) => {
    return x * 2;
  }
});
```

### 函数补全工作流
1. 用户执行 `plan "需求" --auto-complete`
2. CLI hook 初始化 ConfigManager，设置 `autoComplete: true`
3. `planCommand` 从容器获取 `MockServiceFactory`，创建 `CompletionOrchestratorImpl`
4. 检测到缺失函数时，`CompletionOrchestratorImpl` 协调生成：
   - `LLMFunctionCodeGeneratorImpl` 使用 `LLMAdapter` 生成代码
   - 保存到 `.data/plans/{planId}/mocks/` 目录
   - 加载注册 → 标记元数据
5. 重新规划，直到成功或达到最大迭代次数

### 函数代码生成架构
```
┌─────────────────────┐
│     LLMAdapter      │  ← 底层接口：抽象 LLM 调用
│ generateCode(prompt)│    AnthropicLLMAdapter / CLILLMAdapter
└─────────┬───────────┘
          ↑
          │ 组合
          ↓
┌─────────────────────┐
│ FunctionCodeGenerator  │  ← 高层接口：prompt 构建 + 格式化
│   generate(spec)    │    LLMFunctionCodeGeneratorImpl
└─────────────────────┘
```

### MockServiceFactory 容器绑定
```typescript
// src/container.ts
import { LLMAdapter } from './function-completion/interfaces/LLMAdapter.js';
import { AnthropicLLMAdapter } from './function-completion/adapters/AnthropicLLMAdapter.js';
import { MockServiceFactory, MockServiceFactoryImpl } from './function-completion/factory/MockServiceFactory.js';

// LLMAdapter - AnthropicLLMAdapter 实现（从 ConfigManager 获取配置）
container.bind(LLMAdapter).toDynamicValue(() => {
    const config = ConfigManager.get();
    return new AnthropicLLMAdapter(config.api.apiKey, config.api.baseURL);
});

// MockServiceFactory - 单例（依赖注入 LLMAdapter, Storage, FunctionRegistry）
container.bind(MockServiceFactory).to(MockServiceFactoryImpl);
```

### Logger 使用
```typescript
import { LoggerFactory } from './logger/index.js';

const logger = LoggerFactory.create();
logger.info('消息', { 上下文数据 });
logger.error('错误', error, { 额外上下文 });
```
- 日志级别通过 `LOG_LEVEL` 环境变量控制
- 生产环境建议使用 `warn` 或 `error`

## 项目结构关键点

```
src/
├── cli/                    # CLI 入口和命令
│   ├── index.ts           # Commander 配置 + ConfigManager 初始化
│   ├── commands/          # plan, execute, list, sessions 命令
│   └── utils.ts           # 函数加载工具
├── config/                # 配置管理（v2.0 新架构）
│   ├── ConfigManager.ts   # 单例配置管理器
│   ├── loader.ts          # 配置加载逻辑
│   ├── defaults.ts        # 默认配置
│   └── types.ts           # 配置类型定义
├── registry/              # 函数注册表
├── planner/               # 计划生成（LLM 交互）
│   ├── planner.ts
│   ├── adapters/          # LLM 客户端适配器
│   └── interfaces/        # IPlannerLLMClient
├── executor/              # 计划执行引擎
│   ├── executor.ts
│   ├── context.ts         # 执行上下文（解析引用）
│   └── session/           # 执行会话管理
│       ├── types.ts       # ExecutionSession 类型定义
│       ├── interfaces/    # ExecutionSessionStorage, ExecutionSessionManager
│       ├── storage/       # 存储实现（ExecutionSessionStorageImpl）
│       └── managers/      # 会话管理器（ExecutionSessionManagerImpl）
├── storage/               # 持久化存储
│   └── interfaces/Storage.ts  # ⚠️ saveExecution/loadExecution 已废弃
├── services/              # 计划改进服务
│   ├── InteractivePlanService.ts
│   └── storage/           # PlanRefinementSessionStorage
│       ├── interfaces/PlanRefinementSessionStorage.ts
│       └── PlanRefinementSessionStorage.ts
├── function-completion/                  # 函数自动补全系统
│   ├── interfaces/        # 6 个小接口 (ISP)
│   │   └── LLMAdapter.ts  # LLM 调用抽象接口
│   ├── implementations/   # 具体实现类
│   ├── decorators/        # PlannerWithMockSupport (OCP)
│   ├── adapters/          # LLM 适配器
│   │   ├── AnthropicLLMAdapter.ts
│   │   └── CLILLMAdapter.ts
│   └── factory/           # 工厂类
│       ├── MockServiceFactory.ts      # 接口
│       └── MockServiceFactoryImpl.ts  # 实现类
├── validation/            # 数据验证
├── errors/                # 自定义错误类型
└── logger/                # 日志系统

functions/                 # 函数定义
├── math.ts               # 基础数学函数
└── generated/            # 自动生成的补全函数

.data/                    # 运行时数据（git ignored）
├── plans/                # 计划 JSON 文件
│   ├── plan-abc.json     # 旧格式计划（兼容）
│   └── plan-abc-v1.json  # 版本化计划
├── execution-sessions/   # 执行会话记录（新增）
│   ├── session-a1b2c3d4.json
│   └── session-x9y8z7w6.json
└── refinement-sessions/  # Plan 改进会话（原 sessions/）
    └── session-xyz123.json
```

## 配置系统

### 配置文件优先级
1. **CLI 参数**（最高）：`--auto-complete`、`--max-retries`
2. **环境变量**：`process.env.AUTO_COMPLETE_FUNCTIONS`、`FUNCTION_COMPLETION_MAX_RETRIES`
3. **.env 文件**：项目根目录的 `.env`（使用 dotenv 加载）
4. **默认值**（最低）：`src/config/defaults.ts`

### 关键环境变量
```bash
# API 配置（必需，二选一）
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_AUTH_TOKEN=sk-ant-...  # Claude Code 兼容

# LLM 配置
LLM_MODEL=claude-sonnet-4-20250514
LLM_MAX_TOKENS=1024

# 函数补全
AUTO_COMPLETE_FUNCTIONS=false  # 默认禁用
FUNCTION_COMPLETION_MAX_RETRIES=3
FUNCTION_COMPLETION_OUTPUT_DIR=functions/generated

# 其他
EXECUTOR_STEP_TIMEOUT=30000  # 毫秒
STORAGE_DATA_DIR=.data
LOG_LEVEL=info  # debug, info, warn, error
```

## 参考文档

- **架构设计**：`docs/function-completion-design.md` - Function Completion 系统的 SOLID 设计详解
- **配置指南**：`docs/configuration.md` - 完整的配置选项说明
- **快速开始**：`docs/quickstart.md` - 5 分钟快速上手

## 故障排查

**测试失败：API key 相关**
- 测试期望使用默认配置，但 `.env` 文件可能有自定义配置
- 确保测试环境变量隔离（在测试中 `delete process.env.XXX`）

**CLI 命令不退出**
- 已修复（commit a0cb241）：所有命令现在会调用 `process.exit()`
- 如果出现新问题，检查命令是否在所有代码路径都调用了 `process.exit()`

**函数补全失败**
- 检查 `AUTO_COMPLETE_FUNCTIONS` 是否启用
- 查看日志中 LLM API 调用是否成功
- 验证生成的代码文件是否保存到 `.data/plans/{planId}/mocks/`
- 确认 `LLMAdapter` 绑定正确（AnthropicLLMAdapter 或 CLILLMAdapter）
- CLI 模式需要确保对应命令在 PATH 中可用

**ExecutionSession 和旧 Execution 存储**
- ⚠️ **废弃**：`Storage.saveExecution()`, `loadExecution()`, `listExecutions()` 已废弃
- **新方式**：使用 `ExecutionSessionManager` 管理执行会话
  - 每次 `execute` 命令会创建独立的 `ExecutionSession`
  - 会话数据存储在 `.data/execution-sessions/` 目录
  - 旧数据（`.data/executions/`）不会自动迁移
- **迁移指南**：
  - 新执行自动使用新格式
  - 旧执行数据可手动导出，但不影响新功能
  - 使用 `sessions list` 命令查看所有新格式会话

**PlanRefinementSession vs ExecutionSession**
- **PlanRefinementSession**: 用于 `refine` 命令，存储计划改进的对话历史
  - 存储位置：`.data/refinement-sessions/`
- **ExecutionSession**: 用于 `execute` 命令，存储执行状态和结果
  - 存储位置：`.data/execution-sessions/`
- 两者功能完全分离，避免混淆
