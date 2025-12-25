# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 🔌 **LLMAdapter 接口抽象**: 重构代码生成器架构
  - 新增 `LLMAdapter` 接口，抽象 LLM 调用层
  - 新增 `ClaudeCodeLLMAdapter`: Claude Code CLI 实现（`claude -p`）
  - 重命名 `AnthropicLLMClient` → `AnthropicLLMAdapter`
  - 支持切换不同 LLM provider（API/CLI）
- 🏭 **MockServiceFactory 工厂类改造**: 符合 InversifyJS 容器规范
  - `MockServiceFactory.ts`: 接口定义 + Symbol
  - `MockServiceFactoryImpl.ts`: 实现类，使用 `@injectable`
  - 通过容器注入 `LLMAdapter`、`Storage`、`FunctionRegistry` 依赖
- ✅ 新增 7 个 `MockServiceFactoryImpl` 单元测试

### Changed
- 🎮 **交互模式**: `plan` 命令新增 `-i/--interactive` 选项，支持一站式完成计划、改进、执行
  - 简化的单输入交互设计，支持直接输入改进指令或执行命令
  - 新增 `show` (s) 命令：在交互过程中随时查看当前计划
  - 自动版本迁移，无缝对接版本管理系统
  - 内联执行功能，无需切换命令
  - SIGINT 信号处理：支持 Ctrl+C 优雅退出
- 📋 **版本号显示**: 新增 `-v, --version` 选项，显示程序版本号（自动读取 package.json）
- 🔧 **增强的函数列表**: `list functions` 命令现在区分显示内置函数和 Mock 函数
  - 分类展示：内置函数和 Mock 函数分别显示
  - 统计信息：显示函数数量和 Mock 函数路径
  - 彩色标记：Mock 函数用黄色高亮显示
  - 友好提示：告知用户可以编辑 Mock 文件

### Changed
- 🗂️ **Mock 函数存储架构重构**: Mock 函数现在跟随 Plan 存储（而非全局存储）
  - 新存储路径：`.data/plans/{planId}/mocks/{name}-v{n}.js`
  - 支持版本迭代：自动检测现有版本并升级（v1 → v2 → v3...）
  - 新增 `MockFunctionReference` 类型记录版本和路径信息
  - 生命周期管理：删除 Plan 时自动清理其 Mock 函数
  - 新增 Storage 方法：`getPlanMocksDir`, `savePlanMock`, `loadPlanMocks`, `deletePlanWithMocks`
- 🔧 **CLI 参数优先级修复**: `--no-auto-mock` 现在可以正确覆盖 `.env` 中的 `AUTO_GENERATE_MOCK=true`
  - 修复 `preAction` hook 正确获取子命令选项
  - CLI 参数现在具有最高优先级

### Fixed
- 🐛 修复 `--no-auto-mock` CLI 参数被 `.env` 覆盖的问题
- 🐛 修复 `preAction` hook 无法获取子命令选项的问题
- 🐛 修复交互模式中的字符编码问题（乱码字符）
- 🧹 代码清理：移除 `interactivePlanFlow` 中未使用的 `basePlanner` 参数
- 🚪 改进退出逻辑：`quit` 命令不再调用 `process.exit(0)`，使用 `break` 优雅退出循环

### Documentation
- 📚 新增 `docs/code-review-interactive-mode.md` - 交互模式代码审查报告
- 📝 README 更新：添加交互模式使用示例和 show 命令说明

## [2.0.0] - 2024-12-23

### Added
- 🔄 **交互式改进功能**: 新增 `refine` 命令，支持多轮对话式改进执行计划
  - 使用自然语言描述修改需求（例如："把第2步改成使用 multiply 函数"）
  - 支持单次改进（`-p` 参数）和多轮交互模式
  - 会话持久化，可使用 `-s` 参数继续之前的会话
- 📝 **版本管理系统**: 计划改进自动生成新版本（plan-xxx-v1, v2, v3...）
  - 扩展 Storage 类，新增版本管理方法（`savePlanVersion`, `loadPlanVersion`, `loadLatestPlanVersion`, `listPlanVersions`）
  - 自动解析版本化 plan ID（`plan-abc-v2` 格式）
  - 支持旧格式计划自动迁移到版本化格式
- 💾 **会话管理**: 新增 `SessionStorage` 类，持久化对话历史
  - 保存会话到 `.data/sessions/` 目录
  - 支持会话的创建、加载、更新、删除、列表等操作
  - 自动跟踪消息历史、当前版本、会话状态
- 🤖 **InteractivePlanService**: 新增服务层，封装交互式改进的业务逻辑
  - `createPlan()`: 创建计划并初始化会话
  - `refinePlan()`: 基于 LLM 的计划改进
  - `getPlanHistory()`: 获取计划所有版本历史
  - `getSession()`: 获取会话详情
- 🔌 **AnthropicPlanRefinementLLMClient**: 新增 LLM 适配器，专门用于计划改进
  - 结构化的 refinement prompt 工程
  - 支持对话历史上下文（最近 6 条消息）
  - 返回改进后的计划和变更说明
- ✅ 新增 42 个单元测试
  - `InteractivePlanService` 测试套件（12 个测试）
  - `SessionStorage` 测试套件（8 个测试）
  - Storage 版本管理测试（22 个测试）
- 📚 新增文档：`docs/code-review-interactive-mode.md` - 交互模式代码审查报告

### Changed
- 🏗️ **架构优化**: 为未来 Web 应用迁移做准备
  - Service 层与 CLI 层分离
  - 依赖注入设计，易于测试和扩展
  - 异步、无状态的 API 设计
- 🔧 构造函数重构: `AnthropicPlannerLLMClient` 和 `AnthropicPlanRefinementLLMClient` 使用单一配置对象
- 📝 CLI 命令注册: 在 `src/cli/index.ts` 中注册 `refine` 命令

## [1.3.0] - 2024-12-20

### Added
- ⚙️ **配置管理重构**: 实现 `ConfigManager` 单例模式
  - 支持 CLI 参数、环境变量、配置文件三级配置优先级
  - 全局 preAction hook 自动初始化配置
  - 所有命令统一使用 `ConfigManager.get()` 获取配置
- 📄 新增 `.env.example` 配置模板文件
- 📝 新增 `docs/configuration.md` 配置指南文档
- ✅ 新增 20 个 ConfigManager 单元测试

### Changed
- 🔄 迁移所有命令到 ConfigManager（plan, execute, list 等）
- 📚 更新文档，添加配置指南链接

### Fixed
- 🐛 修复配置加载的边界情况和验证逻辑

## [1.2.0] - 2024-12-15

### Added
- ⚡ **自动 Mock 生成功能**: 当缺少函数时自动生成可执行的 mock 实现
  - `plan` 命令新增 `--auto-mock` 和 `--mock-max-iterations` 选项
  - 支持环境变量 `AUTO_GENERATE_MOCK` 和 `MOCK_MAX_ITERATIONS` 配置
  - Mock 函数保存到 `functions/generated/` 目录
  - 使用 Decorator 模式（`PlannerWithMockSupport`）扩展 Planner
- 🏭 **Mock 生成服务架构**:
  - `LLMMockCodeGenerator`: 基于 LLM 的代码生成器
  - `DynamicMockCodeValidator`: TypeScript 代码动态验证
  - `MockFunctionPersistence`: Mock 函数持久化
  - `MockOrchestrator`: 编排完整的 Mock 生成流程
  - `MockServiceFactory`: 服务工厂模式
- ✅ 新增 26 个 Mock 生成相关测试
- 📚 新增文档：`docs/mock-generation-design.md` - Mock 系统架构设计

### Changed
- 🏗️ 遵循 SOLID 原则重构代码结构
  - 单一职责：每个类职责明确
  - 开闭原则：使用装饰器模式扩展功能
  - 依赖倒置：基于接口编程

## [1.1.0] - 2024-12-10

### Added
- 📊 **日志系统**: 新增 `LoggerFactory` 支持可配置的日志级别
  - 支持 `LOG_LEVEL` 环境变量（debug, info, warn, error）
  - 结构化日志输出，包含时间戳和上下文
- 🔍 改进 LLM 调试: 支持打印发送给 LLM API 的消息内容
- ✅ 新增 14 个 Logger 单元测试

### Changed
- 🔧 使用 `dotenv` 库统一管理环境变量加载

## [1.0.0] - 2024-12-01

### Added
- 🤖 **智能规划**: 使用 Claude API 将自然语言需求转换为可执行的函数调用链
- 🔗 **链式执行**: 支持多步骤顺序执行，步骤间数据自动传递
- 🔍 **缺口识别**: 自动识别缺失的函数并生成建议
- 📦 **持久化存储**: 计划和执行记录本地保存到 `.data/` 目录
- 🎯 **类型安全**: 完整的 TypeScript 类型支持
- 💻 **CLI 命令**:
  - `plan <request>`: 生成执行计划
  - `execute <planId>`: 执行指定计划
  - `list functions`: 列出已注册函数
  - `list plans`: 列出所有计划
  - `show-plan <planId>`: 查看计划详情
- 🔧 **内置函数**: 基础数学函数（add, subtract, multiply, divide）
- ✅ **TDD 开发**: 初始 59 个单元测试
  - Registry 测试（10 个）
  - Planner 测试（6 个）
  - Executor 测试（10 个）
  - Storage 测试（8 个）
  - Validation 测试（17 个）
  - 端到端测试（8 个）

### Core Architecture
- **Function Registry**: 函数注册和管理
- **Planner**: LLM 驱动的计划生成
- **Executor**: 计划执行引擎
- **Storage**: 本地文件存储
- **Validation**: 输入输出验证

---

## 版本说明

### 版本号规则
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- **主版本号（Major）**: 不兼容的 API 修改
- **次版本号（Minor）**: 向下兼容的功能性新增
- **修订号（Patch）**: 向下兼容的问题修正

### 变更类型
- **Added**: 新功能
- **Changed**: 对现有功能的变更
- **Deprecated**: 即将移除的功能
- **Removed**: 已移除的功能
- **Fixed**: 问题修复
- **Security**: 安全性修复

---

## 路线图

### 即将推出
- 📱 Web 应用迁移（预计 6-12 个月）
- 🔧 Plan 前询问功能（Pre-plan Questions）
- 🧪 更多内置函数和示例
- 📊 执行结果可视化

### 考虑中
- 🌐 多 LLM 支持（OpenAI, Gemini 等）
- 🔄 计划模板系统
- 📈 执行性能分析
- 🔐 权限和安全增强

---

[Unreleased]: https://github.com/yourusername/add-subtract-multiply-divide/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/yourusername/add-subtract-multiply-divide/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/yourusername/add-subtract-multiply-divide/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/yourusername/add-subtract-multiply-divide/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yourusername/add-subtract-multiply-divide/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/yourusername/add-subtract-multiply-divide/releases/tag/v1.0.0
