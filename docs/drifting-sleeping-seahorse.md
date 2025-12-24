# 交互式 Plan 生成与改进功能 - 实现计划

## 需求总结

### 优先级 1：Plan 后改进（自然语言修改）
- 用户用自然语言描述修改意图，如"把第2步改成使用 multiply 函数"
- LLM 理解意图并生成修改后的 Plan
- 保留所有历史版本（plan-xxx-v1, v2, v3...）
- 支持多轮改进对话

### 优先级 2：Plan 前询问（抽象可扩展）
- LLM 在生成 Plan 前主动询问获取额外信息
- 支持多种询问场景：明确模糊需求、询问缺失参数、提供函数选择、确认执行策略
- 设计应该抽象，允许不同的询问策略实现

### 关键约束
- **Web 化预期**：半年到一年内可能改造成 Web 应用
- **架构要求**：Service 层分离业务逻辑，CLI 和未来 Web 都调用同一服务
- **状态管理**：会话化架构，对话历史持久化到存储
- **SOLID 原则**：特别是 OCP（装饰器）和 DIP（依赖注入）

---

## 整体架构设计

### 1. 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  ┌──────────────┐              ┌──────────────┐         │
│  │  CLI Layer   │              │  Web Layer   │ (未来)  │
│  │  (commands/) │              │  (API/WS)    │         │
│  └──────┬───────┘              └──────┬───────┘         │
└─────────┼──────────────────────────────┼────────────────┘
          │                              │
          └──────────────┬───────────────┘
                         │ 依赖注入
┌────────────────────────▼─────────────────────────────────┐
│                   Service Layer (新增)                    │
│  ┌──────────────────────────────────────────────────┐    │
│  │       InteractivePlanService (核心服务)           │    │
│  │  - createPlan(request, sessionId?)                │    │
│  │  - refinePlan(planId, instruction, sessionId)     │    │
│  │  - getPlanHistory(planId)                         │    │
│  │  - getSession(sessionId)                          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │    InteractionStrategyService (询问策略)          │    │
│  │  - shouldAskQuestions(request, context)           │    │
│  │  - generateQuestions(request, context)            │    │
│  │  - processAnswers(questions, answers)             │    │
│  └──────────────────────────────────────────────────┘    │
└────────────────────────┬──────────────────────────────────┘
                         │ 使用
┌────────────────────────▼─────────────────────────────────┐
│                 Domain Layer (现有)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐      │
│  │  Planner    │  │  Executor    │  │  Storage   │      │
│  │  (核心)     │  │              │  │            │      │
│  └─────────────┘  └──────────────┘  └────────────┘      │
│  ┌─────────────┐  ┌──────────────┐                      │
│  │  Registry   │  │  LLMClient   │                      │
│  └─────────────┘  └──────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### 2. 核心概念

#### Session（会话）
```typescript
interface InteractionSession {
  sessionId: string;           // session-{uuid}
  planId: string;              // 关联的 plan ID
  currentVersion: number;      // 当前版本号
  messages: SessionMessage[];  // 对话历史
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed';
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    planVersion?: number;      // 关联的 plan 版本
    action?: 'create' | 'refine' | 'question';
  };
}
```

#### Plan Version（版本化 Plan）
```typescript
interface VersionedPlan {
  basePlanId: string;          // plan-{uuid} (基础 ID)
  version: number;             // 1, 2, 3...
  fullId: string;              // plan-{uuid}-v{version}
  plan: ExecutionPlan;         // 实际的执行计划
  parentVersion?: number;      // 父版本号
  refinementInstruction?: string;  // 导致此版本的修改指令
  createdAt: string;
}
```

---

## 阶段 1：Plan 后改进功能（优先实现）

### 1.1 新增 Service 层

#### 文件：`src/services/InteractivePlanService.ts`

**职责**：
- 管理交互式 plan 生成和改进的完整生命周期
- 协调 Planner、Storage、Session 管理
- 提供 CLI 和未来 Web 都能使用的统一接口

**核心方法**：
```typescript
class InteractivePlanService {
  constructor(
    private planner: Planner,
    private storage: Storage,
    private sessionStorage: SessionStorage,
    private refinementLLMClient: IPlanRefinementLLMClient
  ) {}

  /**
   * 创建新的 plan（可选：带询问交互）
   */
  async createPlan(
    userRequest: string,
    options: {
      sessionId?: string;        // 可选：使用现有 session
      enablePreQuestions?: boolean;  // 是否启用 plan 前询问
      autoMock?: boolean;
    }
  ): Promise<{
    plan: VersionedPlan;
    session: InteractionSession;
    questions?: Question[];      // 如果需要询问
  }>;

  /**
   * 改进现有 plan（核心功能）
   */
  async refinePlan(
    planId: string,           // plan-xxx 或 plan-xxx-v1
    refinementInstruction: string,  // 用户的自然语言修改指令
    sessionId?: string
  ): Promise<{
    newPlan: VersionedPlan;
    session: InteractionSession;
    changes: PlanChange[];     // 具体改动说明
  }>;

  /**
   * 获取 plan 的所有版本历史
   */
  async getPlanHistory(basePlanId: string): Promise<VersionedPlan[]>;

  /**
   * 获取会话详情
   */
  async getSession(sessionId: string): Promise<InteractionSession>;
}
```

#### 文件：`src/services/interfaces/IPlanRefinementLLMClient.ts`

**职责**：定义 Plan 改进的 LLM 交互接口

```typescript
interface PlanRefinementRequest {
  currentPlan: ExecutionPlan;
  refinementInstruction: string;  // 用户的修改指令
  conversationHistory: SessionMessage[];  // 对话历史上下文
  availableFunctions: FunctionDefinition[];  // 可用函数列表
}

interface PlanRefinementResponse {
  refinedPlan: ExecutionPlan;
  changes: PlanChange[];         // 改动说明
  explanation: string;           // LLM 对改动的解释
}

interface PlanChange {
  type: 'step_modified' | 'step_added' | 'step_removed' | 'step_reordered';
  stepId?: number;
  description: string;
  before?: any;
  after?: any;
}

interface IPlanRefinementLLMClient {
  refinePlan(request: PlanRefinementRequest): Promise<PlanRefinementResponse>;
}
```

#### 文件：`src/services/adapters/AnthropicPlanRefinementLLMClient.ts`

**职责**：实现 Plan 改进的 LLM 调用

**关键 Prompt 设计**：
```typescript
const REFINEMENT_PROMPT = `你是一个执行计划改进专家。用户会提供：
1. 当前的执行计划（JSON 格式）
2. 自然语言的修改指令

你的任务：
1. 理解用户的修改意图
2. 对执行计划进行相应的修改
3. 输出改进后的完整执行计划（JSON 格式）
4. 说明你做了哪些改动

## 当前执行计划
{currentPlan}

## 可用函数列表
{availableFunctions}

## 对话历史
{conversationHistory}

## 用户的修改指令
{refinementInstruction}

请输出 JSON 格式：
{
  "refinedPlan": { /* 完整的 ExecutionPlan */ },
  "changes": [
    {
      "type": "step_modified",
      "stepId": 2,
      "description": "将第2步的函数从 add 改为 multiply",
      "before": { "functionName": "add", ... },
      "after": { "functionName": "multiply", ... }
    }
  ],
  "explanation": "根据你的要求，我将第2步..."
}`;
```

### 1.2 存储扩展

#### 文件：`src/services/storage/SessionStorage.ts`

**职责**：管理 Session 的持久化

```typescript
class SessionStorage {
  private sessionsDir: string;  // .data/sessions/

  async saveSession(session: InteractionSession): Promise<void>;
  async loadSession(sessionId: string): Promise<InteractionSession | null>;
  async updateSession(sessionId: string, updates: Partial<InteractionSession>): Promise<void>;
  async listSessions(): Promise<InteractionSession[]>;
}
```

**文件结构**：
```
.data/
├── plans/
│   ├── plan-abc-v1.json
│   ├── plan-abc-v2.json
│   ├── plan-abc-v3.json
│   └── ...
├── sessions/
│   ├── session-xyz.json    # 包含对话历史
│   └── ...
└── executions/
```

#### 修改：`src/storage/storage.ts`

**扩展功能**：
- 支持版本化 plan ID（`plan-xxx-v1`）
- `savePlan(plan, version?)` - 保存特定版本
- `loadPlanVersion(basePlanId, version)` - 加载特定版本
- `listPlanVersions(basePlanId)` - 列出所有版本

### 1.3 CLI 命令扩展

#### 新增命令：`src/cli/commands/refine.ts`

```typescript
/**
 * 交互式改进 plan 的命令
 *
 * 用法：
 *   npx fn-orchestrator refine plan-abc-v1
 *   npx fn-orchestrator refine plan-abc     # 默认使用最新版本
 */
export async function refineCommand(
  planId: string,
  options: {
    instruction?: string;  // 单次改进指令
    session?: string;      // 继续现有 session
  }
): Promise<void> {
  const service = createInteractivePlanService();

  // 如果没有提供 instruction，进入交互模式
  if (!options.instruction) {
    console.log(chalk.blue('📝 交互式 Plan 改进模式'));
    console.log();

    // 显示当前 plan
    const currentPlan = await storage.loadPlan(planId);
    console.log(formatPlanForDisplay(currentPlan));
    console.log();

    // 多轮改进循环
    while (true) {
      const { instruction } = await inquirer.prompt([{
        type: 'input',
        name: 'instruction',
        message: '请描述你想做的修改（输入 "done" 完成）：',
      }]);

      if (instruction === 'done') break;

      // 调用 service 进行改进
      const result = await service.refinePlan(planId, instruction, sessionId);

      // 显示改进结果
      console.log(chalk.green(`✅ Plan 已更新：${result.newPlan.fullId}`));
      console.log();
      console.log(chalk.cyan('📋 改动说明：'));
      for (const change of result.changes) {
        console.log(`  • ${change.description}`);
      }
      console.log();

      // 更新 planId 为新版本
      planId = result.newPlan.fullId;
    }
  } else {
    // 单次改进
    const result = await service.refinePlan(planId, options.instruction);
    console.log(chalk.green(`✅ Plan 已更新：${result.newPlan.fullId}`));
  }

  process.exit(0);
}
```

#### 注册命令：`src/cli/index.ts`

```typescript
// refine 命令
program
  .command('refine <planId>')
  .description('交互式改进执行计划')
  .option('-i, --instruction <text>', '单次改进指令')
  .option('-s, --session <sessionId>', '继续现有会话')
  .action(refineCommand);

// 扩展 show-plan 命令显示版本历史
program
  .command('show-plan <planId>')
  .description('显示计划详情')
  .option('--history', '显示所有版本历史')
  .action(listCommand.showPlan);
```

---

## 阶段 2：Plan 前询问功能（后续实现）

### 2.1 询问策略接口

#### 文件：`src/services/interfaces/IInteractionStrategy.ts`

```typescript
interface Question {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'text_input';
  question: string;
  options?: string[];
  metadata?: {
    reason: string;        // 为什么要问这个问题
    relatedFunction?: string;
  };
}

interface IInteractionStrategy {
  /**
   * 判断是否需要询问用户
   */
  shouldAsk(
    userRequest: string,
    availableFunctions: FunctionDefinition[]
  ): Promise<boolean>;

  /**
   * 生成要问的问题
   */
  generateQuestions(
    userRequest: string,
    availableFunctions: FunctionDefinition[]
  ): Promise<Question[]>;

  /**
   * 处理用户的回答，生成增强的 prompt
   */
  enhanceRequest(
    originalRequest: string,
    questions: Question[],
    answers: Map<string, string>
  ): Promise<string>;
}
```

### 2.2 具体策略实现

#### 文件：`src/services/strategies/AmbiguityResolutionStrategy.ts`

**场景**：识别并消解需求中的歧义

```typescript
class AmbiguityResolutionStrategy implements IInteractionStrategy {
  constructor(private llmClient: IStrategyLLMClient) {}

  async shouldAsk(request: string, functions: FunctionDefinition[]): Promise<boolean> {
    // 使用 LLM 判断请求是否模糊
    const analysis = await this.llmClient.analyzeAmbiguity(request, functions);
    return analysis.hasAmbiguity;
  }

  async generateQuestions(request: string, functions: FunctionDefinition[]): Promise<Question[]> {
    // 让 LLM 生成消歧问题
    return await this.llmClient.generateAmbiguityQuestions(request, functions);
  }

  async enhanceRequest(
    original: string,
    questions: Question[],
    answers: Map<string, string>
  ): Promise<string> {
    // 将回答整合到原始请求中
    return `${original}\n\n补充说明：${Array.from(answers.entries()).map(([q, a]) => `${q}: ${a}`).join('; ')}`;
  }
}
```

#### 文件：`src/services/strategies/ParameterCollectionStrategy.ts`

**场景**：收集缺失的必需参数

#### 文件：`src/services/strategies/FunctionSelectionStrategy.ts`

**场景**：当有多个函数可选时，让用户选择

### 2.3 集成到 Service

修改 `InteractivePlanService.createPlan()` 支持策略：

```typescript
async createPlan(
  userRequest: string,
  options: {
    sessionId?: string;
    enablePreQuestions?: boolean;
    strategies?: IInteractionStrategy[];  // 注入策略
  }
): Promise<CreatePlanResult> {
  // 如果启用了 pre-questions
  if (options.enablePreQuestions && options.strategies) {
    for (const strategy of options.strategies) {
      if (await strategy.shouldAsk(userRequest, this.registry.getAll())) {
        const questions = await strategy.generateQuestions(userRequest, this.registry.getAll());
        // 返回问题，等待用户回答
        return { questions, needsAnswers: true };
      }
    }
  }

  // 正常生成 plan
  // ...
}
```

---

## 关键实现细节

### 1. 版本管理策略

**Plan ID 格式**：
- 基础 ID：`plan-{uuid}` (例如 `plan-a1b2c3d4`)
- 版本 ID：`plan-{uuid}-v{version}` (例如 `plan-a1b2c3d4-v2`)

**版本继承**：
```
plan-abc-v1 (原始)
  ├─ plan-abc-v2 (修改第2步)
  └─ plan-abc-v3 (添加第4步)
     └─ plan-abc-v4 (基于 v3 继续修改)
```

### 2. Prompt Engineering 要点

**Plan 改进 Prompt**：
- 提供完整的当前 plan JSON
- 提供可用函数列表（描述 + 参数）
- 包含对话历史上下文（最近3轮）
- 明确指示输出格式（refined plan + changes + explanation）
- 要求 LLM 验证修改后的 plan 仍然有效

**关键约束**：
- 步骤依赖必须保持有效（dependsOn）
- 参数引用必须指向存在的步骤
- 函数名必须在 registry 中存在

### 3. CLI 交互流程

```
用户: npx fn-orchestrator refine plan-abc-v1

┌─────────────────────────────────────────────────┐
│ 📋 当前计划：plan-abc-v1                         │
│                                                 │
│ Step 1: add(a=3, b=5)                           │
│   → 计算 3 + 5                                   │
│ Step 2: multiply(a=${step.1.result}, b=2)      │
│   → 将结果乘以 2                                 │
└─────────────────────────────────────────────────┘

? 请描述你想做的修改（输入 "done" 完成）：
> 把第2步改成除以2

🤖 正在处理修改...

✅ Plan 已更新：plan-abc-v2

📋 改动说明：
  • 将第 2 步的函数从 multiply 改为 divide
  • 参数 b 从 2 改为 2（保持不变）

? 还需要其他修改吗？(输入 "done" 完成)
> done

💾 最终计划：plan-abc-v2
执行命令: npx fn-orchestrator execute plan-abc-v2
```

### 4. 测试策略

**单元测试**：
- `InteractivePlanService` 的每个方法
- `AnthropicPlanRefinementLLMClient` 的 prompt 构造
- `SessionStorage` 的持久化逻辑
- 版本管理逻辑

**集成测试**：
- 端到端改进流程：create → refine → execute
- 多轮改进：create → refine(v2) → refine(v3)
- 版本历史查询

**LLM 测试**（使用 mock）：
- 模拟 LLM 返回预期的改进结果
- 验证 prompt 构造正确性

---

## 关键文件清单

### 新增文件

**Service 层**：
- `src/services/InteractivePlanService.ts` - 核心服务
- `src/services/interfaces/IPlanRefinementLLMClient.ts` - 改进接口
- `src/services/adapters/AnthropicPlanRefinementLLMClient.ts` - LLM 实现
- `src/services/storage/SessionStorage.ts` - 会话存储
- `src/services/types.ts` - 类型定义
- `src/services/index.ts` - 导出

**Strategy 层**（阶段2）：
- `src/services/interfaces/IInteractionStrategy.ts`
- `src/services/strategies/AmbiguityResolutionStrategy.ts`
- `src/services/strategies/ParameterCollectionStrategy.ts`
- `src/services/strategies/FunctionSelectionStrategy.ts`

**CLI 层**：
- `src/cli/commands/refine.ts` - refine 命令

**测试**：
- `src/services/__tests__/InteractivePlanService.test.ts`
- `src/services/__tests__/SessionStorage.test.ts`
- `__tests__/e2e-interactive.test.ts` - 端到端测试

### 修改文件

- `src/storage/storage.ts` - 扩展支持版本化 plan
- `src/cli/index.ts` - 注册 refine 命令
- `src/cli/commands/list.ts` - 扩展 show-plan 显示版本历史
- `src/planner/types.ts` - 可能需要扩展 ExecutionPlan 类型

---

## 实现步骤

### Phase 1: 基础设施（1-2天）
1. 创建 Service 层目录结构
2. 实现 `SessionStorage` 和版本化存储
3. 扩展 `Storage` 类支持版本管理
4. 添加类型定义

### Phase 2: Plan 改进核心（2-3天）
1. 实现 `IPlanRefinementLLMClient` 接口
2. 实现 `AnthropicPlanRefinementLLMClient`
3. 设计和测试 refinement prompt
4. 实现 `InteractivePlanService.refinePlan()`

### Phase 3: CLI 集成（1-2天）
1. 实现 `refine` 命令
2. 实现交互式循环
3. 美化输出和错误处理
4. 更新 CLI 帮助信息

### Phase 4: 测试（1-2天）
1. 单元测试
2. 集成测试
3. 手动 E2E 测试

### Phase 5: Plan 前询问（可选，2-3天）
1. 实现策略接口
2. 实现具体策略（歧义消解、参数收集）
3. 集成到 `createPlan()`
4. CLI 支持

---

## Web 化准备

### 当前设计的 Web 友好特性

1. **Service 层独立**：
   - `InteractivePlanService` 不依赖 CLI
   - 可以直接被 REST API / GraphQL 调用

2. **会话化架构**：
   - Session 持久化到文件系统
   - 可以迁移到数据库（PostgreSQL/MongoDB）

3. **异步设计**：
   - 所有方法都是 async
   - 适合 HTTP/WebSocket 场景

4. **无状态 API**：
   - Service 方法不依赖实例状态
   - 每次调用传入完整参数

### 未来 Web API 示例

```typescript
// Express.js 示例
app.post('/api/plans', async (req, res) => {
  const service = createInteractivePlanService();
  const result = await service.createPlan(req.body.userRequest, {
    sessionId: req.body.sessionId,
  });
  res.json(result);
});

app.post('/api/plans/:planId/refine', async (req, res) => {
  const service = createInteractivePlanService();
  const result = await service.refinePlan(
    req.params.planId,
    req.body.instruction,
    req.body.sessionId
  );
  res.json(result);
});

// WebSocket 示例（实时交互）
io.on('connection', (socket) => {
  socket.on('refine-plan', async (data) => {
    const service = createInteractivePlanService();
    const result = await service.refinePlan(
      data.planId,
      data.instruction,
      data.sessionId
    );
    socket.emit('plan-refined', result);
  });
});
```

---

## 风险和考虑

### 风险
1. **LLM 理解能力**：自然语言修改指令可能被误解
   - 缓解：详细的 prompt engineering + 对话历史上下文

2. **版本爆炸**：频繁改进导致大量版本文件
   - 缓解：提供版本清理命令（保留最近N个版本）

3. **修改验证**：LLM 生成的改进可能破坏 plan 有效性
   - 缓解：在 service 层进行严格的 plan 验证

### 未来优化
1. **智能版本合并**：自动识别"琐碎修改"，合并版本
2. **Diff 可视化**：清晰展示版本间差异
3. **Undo/Redo**：支持撤销和重做操作
4. **模板和预设**：常见改进模式的快捷方式

---

## 总结

这个设计方案：
- ✅ 满足"plan 后改进"的核心需求（自然语言 + 版本管理）
- ✅ 为"plan 前询问"预留了扩展接口（Strategy 模式）
- ✅ Service 层分离，为 Web 化做好准备
- ✅ 会话化架构，支持持久化对话历史
- ✅ 遵循 SOLID 原则，易于测试和扩展
- ✅ 适度抽象，不过度设计
