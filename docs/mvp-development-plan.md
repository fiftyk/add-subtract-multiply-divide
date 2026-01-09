# fn-orchestrator Web UI MVP 开发计划

> **目标**：实现一个基于 A2UI 协议的 Web 界面，展示专利查询功能的完整执行流程
>
> **预计工期**：分 3 个 Sprint 完成
>
> **最后更新**：2026-01-08

---

## 📋 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [MVP 功能范围](#mvp-功能范围)
- [开发阶段](#开发阶段)
- [详细任务清单](#详细任务清单)
- [技术风险与应对](#技术风险与应对)
- [验收标准](#验收标准)

---

## 项目概述

### MVP 目标

构建一个 Web 应用，展示 fn-orchestrator 的核心能力：
1. 用户通过 Web 界面提交执行计划
2. 系统请求用户输入（A2UI 表单）
3. 调用后端函数执行业务逻辑
4. 实时显示执行进度和结果

### Demo 场景：专利查询

- **步骤 1**：用户输入公司名称、开始日期、截止日期
- **步骤 2**：调用 `queryPatents` 函数查询专利
- **步骤 3**：以表格形式展示查询结果

### 核心价值

- ✅ 验证 A2UI 协议的可行性
- ✅ 展示前后端分离架构
- ✅ 证明会话管理机制的有效性
- ✅ 提供可扩展的 UI 框架

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 20+ | 运行时环境 |
| **Fastify** | 4.x | Web 框架（高性能、原生 TypeScript 支持） |
| **TypeScript** | 5.x | 类型安全 |
| **InversifyJS** | 已有 | 依赖注入 |
| **SSE (Server-Sent Events)** | 原生 | 实时推送 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | 3.4+ | UI 框架 |
| **TypeScript** | 5.x | 类型安全 |
| **Vite** | 5.x | 构建工具 |
| **Pinia** | 2.x | 状态管理 |
| **Vue Router** | 4.x | 路由管理 |
| **Tailwind CSS** | 3.x | 样式框架 |

### 开发工具

- **Vitest**: 单元测试
- **Playwright**: E2E 测试
- **ESLint + Prettier**: 代码规范
- **Docker**: 容器化部署

### 为什么选择 Fastify？

相比 Express，Fastify 提供：

✅ **更高性能** - 比 Express 快 2-3 倍（基准测试）
✅ **原生 TypeScript 支持** - 开箱即用的类型定义
✅ **Schema 验证** - 内置 JSON Schema 验证，更快更安全
✅ **插件生态** - 官方插件丰富（@fastify/cors, @fastify/static 等）
✅ **异步优先** - 完全拥抱 async/await，无回调地狱
✅ **更好的开发体验** - 清晰的错误提示，自动类型推导

**性能对比**（req/sec）：
- Fastify: ~40,000
- Express: ~15,000
- Koa: ~20,000

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Vue 3 Application                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │ ExecutionView│  │ A2UIRenderer │  │SessionMgr│ │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │    │
│  │           │                │                │       │    │
│  └───────────┼────────────────┼────────────────┼───────┘    │
│              │                │                │             │
│         HTTP POST         SSE Stream      HTTP POST         │
└──────────────┼────────────────┼────────────────┼─────────────┘
               ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Fastify Server                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  API Layer                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │ POST /execute│  │ GET /stream  │  │POST /resume│    │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │    │
│  └───────────┬────────────────┬────────────────┬───────┘    │
│              │                │                │             │
│              ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Business Layer (existing)                          │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐   │   │
│  │  │ SessionManager   │  │ Executor             │   │   │
│  │  └──────────────────┘  └──────────────────────┘   │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐   │   │
│  │  │ SessionStorage   │  │ FunctionProvider     │   │   │
│  │  └──────────────────┘  └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
1. 用户点击"执行计划"
   → POST /api/sessions/execute {planId}
   → 创建 session
   ← 返回 {sessionId}

2. 前端建立 SSE 连接
   → GET /api/sessions/{sessionId}/stream
   ← SSE: {"type":"executionStart"}
   ← SSE: {"type":"stepStart","stepId":1}
   ← SSE: {"type":"inputRequested","schema":{...}}

3. 前端渲染表单，用户填写
   → POST /api/sessions/{sessionId}/resume {inputData}
   ← {"status":"resumed"}

4. 后端继续执行
   ← SSE: {"type":"stepComplete","stepId":1}
   ← SSE: {"type":"stepStart","stepId":2}
   ← SSE: {"type":"stepComplete","stepId":2,"result":[...]}
   ← SSE: {"type":"executionComplete","finalResult":[...]}
```

---

## MVP 功能范围

### ✅ 包含功能

#### 后端 API
- [x] POST /api/sessions/execute - 创建执行会话
- [x] GET /api/sessions/:id/stream - SSE 事件流
- [x] POST /api/sessions/:id/resume - 恢复执行（提交用户输入）
- [x] GET /api/sessions/:id - 获取会话详情
- [x] GET /api/plans - 获取计划列表
- [x] GET /api/plans/:id - 获取计划详情

#### 前端界面
- [x] 计划列表页
- [x] 计划详情页（展示 JSON）
- [x] 执行页面（主要功能）
  - 显示执行进度
  - 渲染用户输入表单（A2UI）
  - 显示步骤结果
  - 显示最终结果表格
- [x] 会话历史页

#### A2UI 组件支持
- [x] TextField（文本输入）
- [x] DateField（日期选择）
- [x] Button（提交按钮）
- [x] Table（结果表格）
- [x] Badge（状态标签）
- [x] Text（标题、描述）

### ❌ 暂不包含

- 计划编辑器（使用预定义 JSON）
- 用户认证/授权
- 多用户协作
- 计划版本管理
- 高级表单组件（select、multi_select、number、boolean）
- 条件分支可视化
- 实时代码编辑
- 移动端适配
- 国际化（i18n）
- 性能监控

---

## 开发阶段

### Sprint 1: 后端 API 开发（3 天）

**目标**：搭建 Fastify 服务器，实现核心 API 端点

#### 任务列表

1. **项目搭建** (0.5 天)
   - [ ] 创建 `web-server/` 目录
   - [ ] 初始化 Fastify + TypeScript 项目
   - [ ] 配置 tsconfig.json
   - [ ] 配置 ESLint + Prettier
   - [ ] 设置开发脚本（dev/build/start）

2. **API 路由实现** (1 天)
   - [ ] 实现 `POST /api/sessions/execute`
     - 验证 planId
     - 调用 `ExecutionSessionManager.createSession()`
     - 启动异步执行
     - 返回 sessionId
   - [ ] 实现 `GET /api/sessions/:id`
     - 调用 `ExecutionSessionStorage.loadSession()`
     - 返回会话详情
   - [ ] 实现 `POST /api/sessions/:id/resume`
     - 验证会话状态（必须是 waiting_input）
     - 调用 `ExecutionSessionManager.resumeSession()`
     - 触发继续执行

3. **SSE 实现** (1 天)
   - [ ] 实现 `GET /api/sessions/:id/stream`
     - 设置 SSE headers
     - 建立长连接
     - 管理连接池（sessionId -> Response[]）
   - [ ] 实现事件发射器
     - `emitExecutionStart(sessionId)`
     - `emitStepStart(sessionId, stepId)`
     - `emitInputRequested(sessionId, schema)`
     - `emitStepComplete(sessionId, stepId, result)`
     - `emitExecutionComplete(sessionId, result)`

4. **集成现有系统** (0.5 天)
   - [ ] 修改 `ExecutionSessionManagerImpl`
     - 添加事件钩子（onStepStart, onStepComplete 等）
     - 在 user_input 步骤触发 `emitInputRequested`
   - [ ] 测试 CLI 兼容性（确保不影响现有功能）

**交付物**：
- ✅ 可运行的 Fastify 服务器
- ✅ 所有 API 端点响应正确
- ✅ SSE 连接正常工作
- ✅ 10+ 单元测试通过

---

### Sprint 2: 前端基础框架（3 天）

**目标**：搭建 Vue 3 应用，实现基础页面和路由

#### 任务列表

1. **项目搭建** (0.5 天)
   - [ ] 使用 Vite 创建 Vue 3 + TS 项目
   - [ ] 安装依赖：Vue Router, Pinia, Tailwind CSS
   - [ ] 配置 Tailwind CSS
   - [ ] 设置目录结构
     ```
     web-ui/
     ├── src/
     │   ├── components/     # 可复用组件
     │   ├── views/          # 页面组件
     │   ├── stores/         # Pinia stores
     │   ├── services/       # API 服务
     │   ├── types/          # TypeScript 类型
     │   └── router/         # 路由配置
     ```

2. **API 服务层** (0.5 天)
   - [ ] 创建 `services/api.ts`
     - `executeSession(planId)`
     - `resumeSession(sessionId, inputData)`
     - `getSessionDetails(sessionId)`
     - `listPlans()`
   - [ ] 创建 `services/sse.ts`
     - `connectToSessionStream(sessionId, handlers)`
     - 处理 SSE 事件
     - 断线重连逻辑

3. **状态管理** (0.5 天)
   - [ ] 创建 `stores/session.ts`
     - 状态：currentSession, executionEvents, isExecuting
     - Actions：startExecution, submitInput, updateProgress
   - [ ] 创建 `stores/plans.ts`
     - 状态：planList, selectedPlan
     - Actions：loadPlans, selectPlan

4. **基础页面** (1 天)
   - [ ] 计划列表页 (`views/PlanListView.vue`)
     - 显示所有可用计划
     - 点击进入详情页
   - [ ] 计划详情页 (`views/PlanDetailView.vue`)
     - 显示计划 JSON（美化格式）
     - "开始执行"按钮
   - [ ] 执行页面骨架 (`views/ExecutionView.vue`)
     - 顶部：进度条
     - 中间：内容区域（待实现）
     - 底部：状态栏

5. **路由配置** (0.5 天)
   - [ ] 配置路由
     ```typescript
     / → PlanListView
     /plans/:id → PlanDetailView
     /execution/:sessionId → ExecutionView
     /history → SessionHistoryView (简单列表)
     ```

**交付物**：
- ✅ 可访问的 Web 应用
- ✅ 页面导航正常
- ✅ API 调用成功
- ✅ 基础样式完整

---

### Sprint 3: A2UI 渲染与交互（4 天）

**目标**：实现 A2UI 协议，完成表单渲染和结果展示

#### 任务列表

1. **A2UI 核心渲染器** (1.5 天)
   - [ ] 创建 `components/a2ui/A2UIRenderer.vue`
     - 接收 `A2UISchema` prop
     - 动态渲染组件树
     - 使用 `<component :is="componentType">` 动态组件
   - [ ] 实现字段组件
     - `A2UITextField.vue` - 文本输入
     - `A2UIDateField.vue` - 日期选择（HTML5 date input）
     - `A2UIButton.vue` - 提交按钮
   - [ ] 实现表单验证
     - required 检查
     - length 检查
     - pattern 正则检查
     - 显示错误消息

2. **结果展示组件** (1 天)
   - [ ] 创建 `components/a2ui/A2UITable.vue`
     - 接收 headers 和 rows
     - 支持分页（简单实现）
     - 支持排序（可选）
   - [ ] 创建 `components/a2ui/A2UIBadge.vue`
     - success/warning/error 样式
   - [ ] 创建 `components/a2ui/A2UIText.vue`
     - heading/subheading/caption/code 样式

3. **执行页面完善** (1 天)
   - [ ] 实现步骤列表
     - 显示所有步骤
     - 标记当前步骤
     - 显示已完成步骤（✓）
   - [ ] 实现表单区域
     - 监听 `inputRequested` 事件
     - 渲染 A2UIRenderer
     - 收集用户输入
     - 调用 `resumeSession` API
   - [ ] 实现结果区域
     - 监听 `stepComplete` 事件
     - 渲染步骤结果
     - 最终结果用表格展示

4. **SSE 集成** (0.5 天)
   - [ ] 在 ExecutionView mounted 时建立 SSE 连接
   - [ ] 监听事件并更新 UI
     ```typescript
     onMounted(() => {
       connectToSessionStream(sessionId, {
         onExecutionStart: () => { ... },
         onStepStart: (stepId) => { ... },
         onInputRequested: (schema) => { ... },
         onStepComplete: (stepId, result) => { ... },
         onExecutionComplete: (result) => { ... }
       });
     });
     ```

5. **测试与调试** (1 天)
   - [ ] 单元测试
     - A2UIRenderer 测试
     - 表单验证测试
   - [ ] 集成测试
     - 完整执行流程测试
   - [ ] E2E 测试（Playwright）
     - 从计划列表到执行完成
   - [ ] 修复 Bug

**交付物**：
- ✅ 完整的专利查询 Demo 可运行
- ✅ 表单交互流畅
- ✅ 结果展示正确
- ✅ SSE 实时更新
- ✅ 20+ 测试用例通过

---

## 详细任务清单

### 后端任务（web-server/）

#### 1. 项目初始化

```bash
# 任务：创建后端项目
mkdir web-server
cd web-server
npm init -y
npm install fastify @fastify/cors @fastify/static dotenv
npm install -D typescript @types/node tsx
```

**文件清单**：
- [ ] `web-server/package.json`
- [ ] `web-server/tsconfig.json`
- [ ] `web-server/src/index.ts` - 服务器入口
  ```typescript
  import Fastify from 'fastify';
  import cors from '@fastify/cors';

  const fastify = Fastify({
    logger: true
  });

  // 注册 CORS
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
  });

  // 注册路由
  await fastify.register(sessionsRoutes, { prefix: '/api/sessions' });
  await fastify.register(plansRoutes, { prefix: '/api/plans' });

  // 启动服务器
  const start = async () => {
    try {
      await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };
  start();
  ```
- [ ] `web-server/.env.example`

#### 2. API 路由

**文件清单**：
- [ ] `web-server/src/routes/sessions.ts`
  ```typescript
  export default async function sessionsRoutes(fastify: FastifyInstance) {
    fastify.post('/execute', async (request, reply) => { ... });
    fastify.get('/:id', async (request, reply) => { ... });
    fastify.post('/:id/resume', async (request, reply) => { ... });
    fastify.get('/:id/stream', async (request, reply) => { ... });
  }
  ```
- [ ] `web-server/src/routes/plans.ts`
  ```typescript
  export default async function plansRoutes(fastify: FastifyInstance) {
    fastify.get('/', async (request, reply) => { ... });
    fastify.get('/:id', async (request, reply) => { ... });
  }
  ```

#### 3. SSE 管理

**文件清单**：
- [ ] `web-server/src/services/SSEManager.ts`
  ```typescript
  class SSEManager {
    private connections: Map<string, Set<Response>>;

    addConnection(sessionId: string, res: Response): void;
    removeConnection(sessionId: string, res: Response): void;
    emit(sessionId: string, event: SSEEvent): void;
  }
  ```

#### 4. 事件集成

**文件清单**：
- [ ] 修改 `src/executor/session/managers/ExecutionSessionManagerImpl.ts`
  ```typescript
  // 添加事件钩子
  interface ExecutionEventEmitter {
    onStepStart?(stepId: number): void;
    onStepComplete?(stepId: number, result: any): void;
    onInputRequested?(schema: A2UISchema): void;
  }
  ```

---

### 前端任务（web-ui/）

#### 1. 项目初始化

```bash
# 任务：创建前端项目
npm create vite@latest web-ui -- --template vue-ts
cd web-ui
npm install
npm install vue-router pinia
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**文件清单**：
- [ ] `web-ui/package.json`
- [ ] `web-ui/vite.config.ts`
- [ ] `web-ui/tailwind.config.js`
- [ ] `web-ui/src/main.ts`
- [ ] `web-ui/src/App.vue`

#### 2. API 服务

**文件清单**：
- [ ] `web-ui/src/services/api.ts`
  ```typescript
  export async function executeSession(planId: string): Promise<{sessionId: string}>;
  export async function resumeSession(sessionId: string, inputData: any): Promise<void>;
  export async function getSessionDetails(sessionId: string): Promise<ExecutionSession>;
  export async function listPlans(): Promise<ExecutionPlan[]>;
  ```
- [ ] `web-ui/src/services/sse.ts`
  ```typescript
  export function connectToSessionStream(
    sessionId: string,
    handlers: {
      onExecutionStart?: () => void;
      onStepStart?: (stepId: number) => void;
      onInputRequested?: (schema: A2UISchema) => void;
      onStepComplete?: (stepId: number, result: any) => void;
      onExecutionComplete?: (result: ExecutionResult) => void;
      onError?: (error: Error) => void;
    }
  ): () => void; // 返回清理函数
  ```

#### 3. 类型定义

**文件清单**：
- [ ] `web-ui/src/types/a2ui.ts` - 从后端复制 A2UI 类型
- [ ] `web-ui/src/types/session.ts` - 会话相关类型
- [ ] `web-ui/src/types/plan.ts` - 计划相关类型

#### 4. 状态管理

**文件清单**：
- [ ] `web-ui/src/stores/session.ts`
  ```typescript
  export const useSessionStore = defineStore('session', {
    state: () => ({
      currentSessionId: null,
      executionEvents: [],
      currentStep: null,
      isExecuting: false,
      pendingInput: null
    }),
    actions: {
      async startExecution(planId: string) { ... },
      async submitInput(inputData: any) { ... },
      handleSSEEvent(event: SSEEvent) { ... }
    }
  });
  ```

#### 5. 页面组件

**文件清单**：
- [ ] `web-ui/src/views/PlanListView.vue`
- [ ] `web-ui/src/views/PlanDetailView.vue`
- [ ] `web-ui/src/views/ExecutionView.vue`
- [ ] `web-ui/src/views/SessionHistoryView.vue`

#### 6. A2UI 组件

**文件清单**：
- [ ] `web-ui/src/components/a2ui/A2UIRenderer.vue` - 核心渲染器
- [ ] `web-ui/src/components/a2ui/fields/A2UITextField.vue`
- [ ] `web-ui/src/components/a2ui/fields/A2UIDateField.vue`
- [ ] `web-ui/src/components/a2ui/fields/A2UIButton.vue`
- [ ] `web-ui/src/components/a2ui/display/A2UITable.vue`
- [ ] `web-ui/src/components/a2ui/display/A2UIBadge.vue`
- [ ] `web-ui/src/components/a2ui/display/A2UIText.vue`

#### 7. 通用组件

**文件清单**：
- [ ] `web-ui/src/components/common/StepProgress.vue` - 步骤进度条
- [ ] `web-ui/src/components/common/LoadingSpinner.vue`
- [ ] `web-ui/src/components/common/ErrorAlert.vue`

---

## 技术风险与应对

### 🔴 高风险

#### 1. SSE 连接稳定性

**风险**：长连接可能因网络波动断开

**应对**：
- 实现自动重连机制（指数退避）
- 服务端保存最近 N 条事件，重连后补发
- 客户端记录最后收到的事件 ID

```typescript
// 重连逻辑
let retryCount = 0;
const maxRetries = 5;

function connectWithRetry() {
  const eventSource = new EventSource(url);

  eventSource.onerror = () => {
    eventSource.close();
    if (retryCount < maxRetries) {
      setTimeout(() => {
        retryCount++;
        connectWithRetry();
      }, Math.min(1000 * Math.pow(2, retryCount), 30000));
    }
  };
}
```

#### 2. 并发会话管理

**风险**：多个用户同时执行，资源竞争

**应对**：
- 使用文件锁或数据库事务
- 每个 session 独立执行，互不干扰
- 限制并发数量（队列机制）

### 🟡 中风险

#### 3. 表单验证复杂度

**风险**：A2UI schema 验证规则可能很复杂

**应对**：
- MVP 只支持基础验证（required, length, pattern）
- 使用成熟的验证库（zod, yup）
- 服务端也进行验证（双重保险）

#### 4. 大数据量渲染

**风险**：查询结果可能有数百条，表格性能问题

**应对**：
- 实现分页（前端分页）
- 虚拟滚动（可选，MVP 可不做）
- 限制单次查询结果数量

### 🟢 低风险

#### 5. 跨域问题

**应对**：配置 CORS 插件

```typescript
import cors from '@fastify/cors';

await fastify.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true
});
```

#### 6. 类型同步

**应对**：
- 后端导出类型文件到 `web-ui/src/types/backend.ts`
- 使用 monorepo 共享类型（可选）

---

## 验收标准

### Sprint 1 验收

#### API 功能测试

```bash
# 测试创建会话
curl -X POST http://localhost:3000/api/sessions/execute \
  -H "Content-Type: application/json" \
  -d '{"planId":"plan-patent-query"}'
# 预期：返回 {"sessionId":"session-xxx","status":"pending"}

# 测试 SSE 连接
curl -N http://localhost:3000/api/sessions/session-xxx/stream
# 预期：收到 SSE 事件流

# 测试恢复执行
curl -X POST http://localhost:3000/api/sessions/session-xxx/resume \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"companyName":"华为","startDate":"2024-01-01","endDate":"2024-12-31"}}'
# 预期：返回 {"status":"resumed"}
```

#### 单元测试覆盖率

- [x] SSEManager: 90%+
- [x] Sessions Router: 80%+
- [x] Plans Router: 80%+

---

### Sprint 2 验收

#### 页面导航测试

- [ ] 访问 `http://localhost:5173/` 显示计划列表
- [ ] 点击计划进入详情页
- [ ] 点击"开始执行"跳转到执行页面
- [ ] 执行页面正确显示 session ID

#### API 集成测试

- [ ] 前端成功调用所有后端 API
- [ ] 错误处理正确（网络错误、404 等）
- [ ] Loading 状态显示正常

---

### Sprint 3 验收

#### 完整流程测试

**测试步骤**：
1. [ ] 打开浏览器访问 `http://localhost:5173/`
2. [ ] 选择"专利查询"计划
3. [ ] 点击"开始执行"
4. [ ] 等待表单渲染（约 1 秒）
5. [ ] 填写表单：
   - 公司名称：华为技术有限公司
   - 开始日期：2024-01-01
   - 截止日期：2024-12-31
6. [ ] 点击"提交"
7. [ ] 观察步骤进度更新
8. [ ] 查看查询结果表格（应显示 3-5 条专利）
9. [ ] 点击"返回"按钮

**预期结果**：
- ✅ 整个流程顺畅，无报错
- ✅ 表单验证正常工作
- ✅ SSE 事件实时更新 UI
- ✅ 结果表格正确显示

#### 性能测试

- [ ] 页面首次加载 < 2 秒
- [ ] 表单提交响应 < 500ms
- [ ] SSE 消息延迟 < 100ms
- [ ] 结果渲染 < 1 秒

#### 兼容性测试

- [ ] Chrome 最新版 ✓
- [ ] Firefox 最新版 ✓
- [ ] Safari 最新版 ✓
- [ ] Edge 最新版 ✓

---

## 部署方案

### 开发环境

```bash
# 后端（使用 tsx 热重载）
cd web-server
npm run dev  # tsx watch src/index.ts
# 服务运行在 http://localhost:3000

# 前端
cd web-ui
npm run dev  # http://localhost:5173
```

**package.json scripts**:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 生产环境（Docker）

```dockerfile
# Dockerfile
FROM node:20-alpine

# 构建后端
WORKDIR /app/web-server
COPY web-server/package*.json ./
RUN npm ci --only=production
COPY web-server/dist ./dist

# 构建前端
WORKDIR /app/web-ui
COPY web-ui/package*.json ./
RUN npm ci --only=production
COPY web-ui/dist ./dist

# 启动
WORKDIR /app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
```

```bash
# 构建和运行
docker build -t fn-orchestrator-web .
docker run -p 3000:3000 fn-orchestrator-web
```

---

## 后续规划（MVP 之后）

### Phase 2: 增强功能
- 更多 A2UI 组件（select, multi_select, number）
- 条件分支可视化
- 计划在线编辑器
- 实时协作（多人查看同一执行）

### Phase 3: 企业特性
- 用户认证和权限管理
- 审计日志
- 计划版本控制
- 定时执行

### Phase 4: 高级功能
- AI 辅助计划生成
- 性能监控和告警
- 多租户支持
- 插件系统

---

## 参考资源

- [A2UI v0.8 规范](https://a2ui.org/specification/v0.8-a2ui/)
- [项目架构文档](./architecture.md)
- [A2UI 时序图](./a2ui-sequence-diagram.md)
- [专利查询指南](./patent-query-guide.md)
- [Vue 3 文档](https://vuejs.org/)
- [Fastify 文档](https://fastify.dev/)
- [SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 附录

### 目录结构（完整）

```
fn-orchestrator/
├── src/                          # 现有核心代码
├── functions/                    # 函数定义
│   ├── math.ts
│   └── queryPatents.ts
├── web-server/                   # 新增：Web 服务器
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── sessions.ts
│   │   │   └── plans.ts
│   │   ├── services/
│   │   │   └── SSEManager.ts
│   │   ├── middleware/
│   │   │   ├── cors.ts
│   │   │   └── errorHandler.ts
│   │   └── types/
│   │       └── sse.ts
│   ├── package.json
│   └── tsconfig.json
├── web-ui/                       # 新增：Vue 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── a2ui/
│   │   │   │   ├── A2UIRenderer.vue
│   │   │   │   ├── fields/
│   │   │   │   │   ├── A2UITextField.vue
│   │   │   │   │   ├── A2UIDateField.vue
│   │   │   │   │   └── A2UIButton.vue
│   │   │   │   └── display/
│   │   │   │       ├── A2UITable.vue
│   │   │   │       ├── A2UIBadge.vue
│   │   │   │       └── A2UIText.vue
│   │   │   └── common/
│   │   │       ├── StepProgress.vue
│   │   │       ├── LoadingSpinner.vue
│   │   │       └── ErrorAlert.vue
│   │   ├── views/
│   │   │   ├── PlanListView.vue
│   │   │   ├── PlanDetailView.vue
│   │   │   ├── ExecutionView.vue
│   │   │   └── SessionHistoryView.vue
│   │   ├── stores/
│   │   │   ├── session.ts
│   │   │   └── plans.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── sse.ts
│   │   ├── types/
│   │   │   ├── a2ui.ts
│   │   │   ├── session.ts
│   │   │   └── plan.ts
│   │   ├── router/
│   │   │   └── index.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
└── docs/
    ├── architecture.md
    ├── a2ui-sequence-diagram.md
    ├── patent-query-guide.md
    └── mvp-development-plan.md    # 本文件
```

### 工作量估算

| 阶段 | 任务 | 预计工时 |
|------|------|----------|
| Sprint 1 | 后端 API | 3 天 |
| Sprint 2 | 前端框架 | 3 天 |
| Sprint 3 | A2UI 渲染 | 4 天 |
| **总计** | | **10 天** |

**注意**：以上为理想情况，实际开发中建议预留 20-30% 缓冲时间。

### 团队分工建议

- **后端开发**（1 人）：负责 Sprint 1 全部 + Sprint 3 的后端集成
- **前端开发**（1 人）：负责 Sprint 2 全部 + Sprint 3 的前端实现
- **全栈开发**（1 人）：可独立完成所有任务，但需要更多时间

### 关键里程碑

- **Day 3**: 后端 API 完成，可用 curl 测试
- **Day 6**: 前端框架完成，可导航页面
- **Day 10**: MVP 完成，完整 Demo 可运行

---

**祝开发顺利！** 🚀
