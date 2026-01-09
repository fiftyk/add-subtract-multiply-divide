# fn-orchestrator Web MVP 开发进度

> **开始日期**: 2026-01-09
>
> **目标**: 实现基于 A2UI 协议的 Web 界面，完整展示执行流程
>
> **预计完成**: 12-13 天

---

## 📊 总体进度

- [x] ~~阶段 0: Web Server 骨架~~ (已完成 2026-01-09)
- [ ] 阶段 1: 后端集成与测试 (预计 2-3 天)
- [ ] 阶段 2: 前端基础框架 (预计 3 天)
- [ ] 阶段 3: A2UI 渲染器 (预计 4 天)
- [ ] 阶段 4: 测试与完善 (预计 2 天)
- [ ] 阶段 5: 部署与文档 (预计 1 天)

**当前阶段**: 阶段 1 - 后端集成与测试

---

## ✅ 阶段 0: Web Server 骨架 (已完成)

**完成日期**: 2026-01-09

### 已完成任务

- [x] 创建 web-server 项目结构
- [x] 配置 TypeScript 和 Fastify
- [x] 实现 Sessions API (mock)
- [x] 实现 Plans API (mock)
- [x] 创建 SSE Manager
- [x] 定义类型系统
- [x] 编写 README 文档
- [x] Git 提交 (commit: 2534e2f)

### 交付物

- ✅ `web-server/` 目录
- ✅ 可运行的 Fastify 服务器
- ✅ Mock API 响应正常
- ✅ SSE 连接机制完整

---

## 🔄 阶段 1: 后端集成与测试 (进行中)

**开始日期**: 2026-01-09
**预计天数**: 2-3 天

### 1.1 连接核心服务

- [ ] 创建 `web-server/src/services/CoreBridge.ts`
  - [ ] 封装 ExecutionSessionManager
  - [ ] 封装 ExecutionSessionStorage
  - [ ] 封装 Storage (计划存储)
  - [ ] 实现 createAndExecuteSession()
  - [ ] 实现 resumeSession()
  - [ ] 实现 getSession()
  - [ ] 实现 listPlans()
  - [ ] 实现 getPlan()

### 1.2 添加事件钩子

- [ ] 修改 `src/executor/session/managers/ExecutionSessionManagerImpl.ts`
  - [ ] 导入 SSEManager
  - [ ] 添加 onStepStart 钩子
  - [ ] 添加 onStepComplete 钩子
  - [ ] 添加 onInputRequired 钩子
  - [ ] 添加 onError 钩子
  - [ ] 发射 executionStart 事件
  - [ ] 发射 executionComplete 事件

- [ ] 修改 `src/executor/implementations/ExecutorImpl.ts`
  - [ ] 支持事件回调参数
  - [ ] 在步骤执行前触发 onStepStart
  - [ ] 在步骤执行后触发 onStepComplete
  - [ ] 在 user_input 步骤触发 onInputRequired

### 1.3 替换 Mock 数据

- [ ] 更新 `web-server/src/routes/sessions.ts`
  - [ ] POST /execute 调用 CoreBridge
  - [ ] POST /:id/resume 调用 CoreBridge
  - [ ] GET /:id 调用 CoreBridge
  - [ ] 移除所有 mock 响应

- [ ] 更新 `web-server/src/routes/plans.ts`
  - [ ] GET / 调用 CoreBridge
  - [ ] GET /:id 调用 CoreBridge
  - [ ] 移除所有 mock 响应

### 1.4 测试验证

- [ ] 使用 CLI 创建测试计划
  - [ ] 简单计算计划 (add + multiply)
  - [ ] 用户输入计划 (模拟专利查询)

- [ ] 测试 API 端点
  - [ ] curl GET /api/plans
  - [ ] curl POST /api/sessions/execute
  - [ ] curl -N GET /api/sessions/:id/stream
  - [ ] curl POST /api/sessions/:id/resume

- [ ] 验证 SSE 事件流
  - [ ] executionStart 事件
  - [ ] stepStart 事件
  - [ ] inputRequested 事件
  - [ ] stepComplete 事件
  - [ ] executionComplete 事件

### 1.5 单元测试

- [ ] SSEManager 测试
  - [ ] addConnection()
  - [ ] emit()
  - [ ] replayEvents()
  - [ ] cleanup()

- [ ] CoreBridge 测试
  - [ ] createAndExecuteSession()
  - [ ] resumeSession()
  - [ ] listPlans()

### 交付物

- [ ] 可运行的完整后端
- [ ] 真实数据替代 mock
- [ ] SSE 事件正确发射
- [ ] 10+ 测试用例通过

---

## 📝 阶段 2: 前端基础框架

**预计天数**: 3 天

### 2.1 创建 Vue 3 项目

- [ ] 初始化 Vite + Vue 3 + TypeScript
- [ ] 安装依赖
  - [ ] vue-router@4
  - [ ] pinia@2
  - [ ] axios
  - [ ] tailwindcss
- [ ] 配置 Tailwind CSS
- [ ] 创建目录结构

### 2.2 API 服务层

- [ ] 创建 `src/services/api.ts`
  - [ ] plansApi.list()
  - [ ] plansApi.get()
  - [ ] sessionsApi.execute()
  - [ ] sessionsApi.resume()
  - [ ] sessionsApi.get()

- [ ] 创建 `src/services/sse.ts`
  - [ ] connectToSessionStream()
  - [ ] 事件解析
  - [ ] 错误处理
  - [ ] 重连机制

### 2.3 类型定义

- [ ] `src/types/session.ts`
- [ ] `src/types/plan.ts`
- [ ] `src/types/a2ui.ts`

### 2.4 Pinia Store

- [ ] 创建 `src/stores/session.ts`
  - [ ] currentSessionId state
  - [ ] isExecuting state
  - [ ] currentStep state
  - [ ] pendingInputSchema state
  - [ ] stepResults state
  - [ ] finalResult state
  - [ ] startExecution() action
  - [ ] submitInput() action

- [ ] 创建 `src/stores/plans.ts`
  - [ ] planList state
  - [ ] selectedPlan state
  - [ ] loadPlans() action

### 2.5 路由配置

- [ ] `src/router/index.ts`
  - [ ] / → PlanListView
  - [ ] /plans/:id → PlanDetailView
  - [ ] /execution/:sessionId → ExecutionView
  - [ ] /history → SessionHistoryView

### 2.6 基础页面

- [ ] `src/views/PlanListView.vue`
  - [ ] 列表展示
  - [ ] 点击跳转详情

- [ ] `src/views/PlanDetailView.vue`
  - [ ] 显示计划 JSON
  - [ ] "开始执行"按钮

- [ ] `src/views/ExecutionView.vue`
  - [ ] 进度显示（骨架）
  - [ ] 表单区域（占位）
  - [ ] 结果区域（占位）

- [ ] `src/views/SessionHistoryView.vue`
  - [ ] 简单列表

### 2.7 通用组件

- [ ] `src/components/common/StepProgress.vue`
- [ ] `src/components/common/LoadingSpinner.vue`
- [ ] `src/components/common/ErrorAlert.vue`

### 交付物

- [ ] 可访问的 Web 应用
- [ ] 页面导航正常
- [ ] API 调用成功
- [ ] 基础样式完整

---

## 🎨 阶段 3: A2UI 渲染器

**预计天数**: 4 天

### 3.1 A2UI 核心渲染器

- [ ] 创建 `src/components/a2ui/A2UIRenderer.vue`
  - [ ] 接收 schema prop
  - [ ] 动态渲染字段
  - [ ] 表单验证
  - [ ] submit 事件

### 3.2 字段组件

- [ ] `src/components/a2ui/fields/A2UITextField.vue`
  - [ ] 文本输入
  - [ ] multiline 支持
  - [ ] placeholder
  - [ ] 错误显示

- [ ] `src/components/a2ui/fields/A2UIDateField.vue`
  - [ ] 日期选择
  - [ ] min/max 限制
  - [ ] 错误显示

- [ ] `src/components/a2ui/fields/A2UIButton.vue`
  - [ ] 主按钮样式
  - [ ] 次要按钮样式
  - [ ] loading 状态

### 3.3 结果展示组件

- [ ] `src/components/a2ui/display/A2UITable.vue`
  - [ ] 表头渲染
  - [ ] 数据行渲染
  - [ ] 分页支持
  - [ ] 排序（可选）

- [ ] `src/components/a2ui/display/A2UIBadge.vue`
  - [ ] success 样式
  - [ ] warning 样式
  - [ ] error 样式

- [ ] `src/components/a2ui/display/A2UIText.vue`
  - [ ] heading 样式
  - [ ] subheading 样式
  - [ ] caption 样式
  - [ ] code 样式

### 3.4 集成到 ExecutionView

- [ ] 渲染 A2UIRenderer
- [ ] 监听 inputRequested 事件
- [ ] 处理表单提交
- [ ] 渲染 A2UITable
- [ ] 监听 executionComplete 事件

### 3.5 样式优化

- [ ] 响应式设计
- [ ] 深色模式（可选）
- [ ] 动画过渡
- [ ] 加载状态

### 交付物

- [ ] 完整的表单交互
- [ ] 结果正确展示
- [ ] 用户体验流畅

---

## 🧪 阶段 4: 测试与完善

**预计天数**: 2 天

### 4.1 E2E 测试 (Playwright)

- [ ] 安装 Playwright
- [ ] 编写测试用例
  - [ ] 完整执行流程
  - [ ] 表单验证
  - [ ] 错误处理
  - [ ] SSE 重连

### 4.2 单元测试

- [ ] A2UIRenderer 测试
- [ ] 字段组件测试
- [ ] Store 测试
- [ ] API 服务测试

### 4.3 Bug 修复

- [ ] 收集测试中的问题
- [ ] 逐一修复
- [ ] 回归测试

### 4.4 性能优化

- [ ] 首屏加载优化
- [ ] SSE 连接优化
- [ ] 表格渲染优化

### 交付物

- [ ] 20+ 测试用例通过
- [ ] 无明显 Bug
- [ ] 性能达标

---

## 📦 阶段 5: 部署与文档

**预计天数**: 1 天

### 5.1 Docker 配置

- [ ] 创建 Dockerfile
- [ ] 创建 docker-compose.yml
- [ ] 创建 docker-entrypoint.sh
- [ ] 测试容器构建
- [ ] 测试容器运行

### 5.2 文档更新

- [ ] 更新根 README.md
- [ ] 添加安装指南
- [ ] 添加使用指南
- [ ] 添加 API 文档
- [ ] 添加常见问题

### 5.3 部署验证

- [ ] 本地 Docker 部署
- [ ] 验证完整流程
- [ ] 性能测试

### 交付物

- [ ] Docker 镜像可用
- [ ] 文档完善
- [ ] 部署指南清晰

---

## 📈 关键指标

### 功能完成度

- 后端集成: 0%
- 前端框架: 0%
- A2UI 渲染: 0%
- 测试覆盖: 0%
- 部署就绪: 0%

### 时间进度

- 已用时间: 1 天
- 剩余时间: 11-12 天
- 总体进度: 8%

---

## 🐛 问题记录

### 待解决

_暂无_

### 已解决

_暂无_

---

## 📝 变更日志

### 2026-01-09

- ✅ 创建 web-server 项目骨架
- ✅ 实现 SSE Manager
- ✅ 实现 Mock API
- ✅ 编写初始文档
- ✅ Git 提交 (2534e2f)
- 📝 创建本进度跟踪文档

---

## 🎯 下一步行动

**当前任务**: 阶段 1.1 - 创建 CoreBridge

**具体步骤**:
1. 创建 `web-server/src/services/CoreBridge.ts`
2. 实现与 ExecutionSessionManager 的集成
3. 测试 API 调用

**预计完成**: 今天晚些时候

---

_最后更新: 2026-01-09_
