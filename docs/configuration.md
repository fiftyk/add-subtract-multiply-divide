# 配置指南

本文档详细说明 fn-orchestrator 的配置系统，包括环境变量、配置文件和命令行参数。

## 配置优先级

配置系统遵循以下优先级顺序（从高到低）：

```
1. 命令行参数 (--auto-complete, --max-retries)
   ↓
2. 环境变量 (AUTO_COMPLETE_FUNCTIONS, FUNCTION_COMPLETION_MAX_RETRIES)
   ↓
3. .env 文件 (通过 dotenv 加载)
   ↓
4. 默认值 (src/config/defaults.ts)
```

**示例**：如果你在 CLI 中使用 `--auto-complete`，即使 `.env` 文件中设置了 `AUTO_COMPLETE_FUNCTIONS=false`，最终也会启用 函数补全。

---

## 快速开始

### 1. 复制配置模板

```bash
cp .env.example .env
```

### 2. 编辑配置文件

```bash
# 使用你喜欢的编辑器
nano .env
# 或
code .env
```

### 3. 填入必需的配置

至少需要设置 API Key：

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## 配置项详解

### API 配置 (必需)

#### `ANTHROPIC_API_KEY` (必需)

Anthropic Claude API 密钥。

- **获取方式**: https://console.anthropic.com/settings/keys
- **格式**: `sk-ant-xxxxx`
- **示例**:
  ```bash
  ANTHROPIC_API_KEY=sk-ant-api03-abc123...
  ```

#### `ANTHROPIC_AUTH_TOKEN` (可选)

Claude Code 兼容的认证 token。如果你已经在使用 Claude Code，可以直接使用这个变量而不需要单独设置 `ANTHROPIC_API_KEY`。

- **优先级**: 低于 `ANTHROPIC_API_KEY`
- **示例**:
  ```bash
  ANTHROPIC_AUTH_TOKEN=sk-ant-api03-abc123...
  ```

#### `ANTHROPIC_BASE_URL` (可选)

自定义 API 端点，用于代理或自建服务。

- **默认值**: Anthropic 官方端点
- **使用场景**:
  - 使用代理服务
  - 自建 API 服务
  - 企业内部 API 网关
- **示例**:
  ```bash
  ANTHROPIC_BASE_URL=https://api.proxy.com
  ```

---

### LLM 配置 (可选)

#### `LLM_MODEL`

使用的 LLM 模型名称。

- **默认值**: `claude-sonnet-4-20250514`
- **可选值**:
  - `claude-sonnet-4-20250514` (推荐，速度快)
  - `claude-opus-4-20250514` (最强大)
  - `claude-3-5-sonnet-20241022`
- **示例**:
  ```bash
  LLM_MODEL=claude-opus-4-20250514
  ```

#### `LLM_MAX_TOKENS`

LLM 响应的最大 token 数。

- **默认值**: `1024`
- **范围**: 1 - 4096
- **建议**:
  - 简单任务: 512-1024
  - 复杂任务: 2048-4096
- **示例**:
  ```bash
  LLM_MAX_TOKENS=2048
  ```

---

### 执行器配置 (可选)

#### `EXECUTOR_STEP_TIMEOUT`

单个步骤的执行超时时间（毫秒）。

- **默认值**: `30000` (30 秒)
- **范围**: > 0
- **使用场景**:
  - 长时间运行的函数需要更大的超时
  - 快速失败需要更小的超时
- **示例**:
  ```bash
  # 1 分钟超时
  EXECUTOR_STEP_TIMEOUT=60000

  # 5 秒超时（快速失败）
  EXECUTOR_STEP_TIMEOUT=5000
  ```

---

### 存储配置 (可选)

#### `STORAGE_DATA_DIR`

执行计划和结果的存储目录。

- **默认值**: `.data`
- **路径**: 相对或绝对路径
- **内容**:
  - `plans/` - 执行计划
  - `executions/` - 执行结果
- **示例**:
  ```bash
  # 相对路径
  STORAGE_DATA_DIR=./custom-data

  # 绝对路径
  STORAGE_DATA_DIR=/var/app/data
  ```

---

### Mock 生成配置 (可选)

#### `AUTO_COMPLETE_FUNCTIONS`

启用/禁用 Mock 函数自动生成。

- **默认值**: `false` (禁用)
- **支持格式**:
  - 启用: `true`, `1`, `yes`, `on` (不区分大小写)
  - 禁用: `false`, `0`, `no`, `off` 或其他任何值
- **使用场景**:
  - **开发阶段**: 启用，快速验证流程
  - **生产环境**: 禁用，使用真实实现
  - **CI/CD**: 根据需要选择
- **示例**:
  ```bash
  # 启用
  AUTO_COMPLETE_FUNCTIONS=true

  # 禁用（默认）
  AUTO_COMPLETE_FUNCTIONS=false
  ```

#### `FUNCTION_COMPLETION_MAX_RETRIES`

Mock 生成的最大迭代次数，防止无限循环。

- **默认值**: `3`
- **范围**: > 0
- **说明**: 当 LLM 生成的 mock 函数仍然不满足需求时，会尝试重新生成，最多重试此次数
- **示例**:
  ```bash
  # 快速验证（1 次）
  FUNCTION_COMPLETION_MAX_RETRIES=1

  # 标准配置（3 次）
  FUNCTION_COMPLETION_MAX_RETRIES=3

  # 复杂场景（5 次）
  FUNCTION_COMPLETION_MAX_RETRIES=5
  ```

#### `MOCK_OUTPUT_DIR`

Mock 函数的输出目录。

- **默认值**: `functions/generated`
- **路径**: 相对或绝对路径
- **注意**: 生成的文件会自动加载到函数注册表
- **示例**:
  ```bash
  MOCK_OUTPUT_DIR=./mocks
  ```

---

### 日志配置 (可选)

#### `LOG_LEVEL`

日志输出级别。

- **默认值**: `info`
- **可选值**:
  - `debug` - 最详细，包含 API 请求/响应
  - `info` - 标准信息
  - `warn` - 仅警告和错误
  - `error` - 仅错误
- **使用场景**:
  - **开发**: `debug`
  - **生产**: `warn` 或 `error`
- **示例**:
  ```bash
  LOG_LEVEL=debug
  ```

---

## 命令行参数

### Mock 相关参数

#### `--auto-complete`

启用 Mock 自动生成（覆盖环境变量）。

```bash
npx fn-orchestrator plan "查询专利CN123" --auto-complete
```

#### `--no-auto-mock`

禁用 Mock 自动生成（覆盖环境变量）。

```bash
npx fn-orchestrator plan "查询专利CN123" --no-auto-mock
```

#### `--max-retries <number>`

设置 Mock 生成的最大迭代次数。

```bash
npx fn-orchestrator plan "复杂需求" --auto-complete --max-retries 5
```

**注意**: `--max-retries` 需要配合 `--auto-complete` 使用，否则会收到警告。

---

## 配置场景示例

### 开发环境

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
LOG_LEVEL=debug
AUTO_COMPLETE_FUNCTIONS=true
FUNCTION_COMPLETION_MAX_RETRIES=3
```

**特点**:
- 详细日志
- 启用 Mock 快速验证
- 标准迭代次数

### 生产环境

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
LOG_LEVEL=warn
AUTO_COMPLETE_FUNCTIONS=false
EXECUTOR_STEP_TIMEOUT=60000
```

**特点**:
- 仅记录警告和错误
- 禁用 Mock，使用真实函数
- 更长的超时时间

### CI/CD 环境

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
LOG_LEVEL=error
AUTO_COMPLETE_FUNCTIONS=true
FUNCTION_COMPLETION_MAX_RETRIES=1
EXECUTOR_STEP_TIMEOUT=10000
```

**特点**:
- 仅记录错误
- 启用 Mock 快速验证流程
- 1 次迭代（快速失败）
- 短超时时间

### 使用代理

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_BASE_URL=https://api.proxy.company.com
LLM_MAX_TOKENS=2048
```

**特点**:
- 自定义 API 端点
- 更大的 token 限制

---

## 配置验证

### 检查配置是否生效

使用 debug 日志查看最终配置：

```bash
LOG_LEVEL=debug npx fn-orchestrator plan "测试" --auto-complete
```

输出会包含：
- 使用的 API 端点
- Mock 配置状态
- 超时设置等

### 常见问题

#### 1. Mock 没有生成

**检查**:
```bash
# 确认配置
echo $AUTO_COMPLETE_FUNCTIONS

# 或者使用 CLI 参数强制启用
npx fn-orchestrator plan "..." --auto-complete
```

#### 2. API Key 错误

**检查**:
```bash
# 确认 Key 已设置
echo $ANTHROPIC_API_KEY

# 确认 Key 格式
# 应该以 sk-ant- 开头
```

#### 3. 配置优先级混淆

**记住优先级**: CLI 参数 > 环境变量 > .env > 默认值

**调试方法**:
```bash
# 使用 CLI 参数覆盖所有配置
npx fn-orchestrator plan "..." --auto-complete --max-retries 1
```

---

## 迁移指南

### 从 v1.x 迁移

**Breaking Change**: v2.0 默认禁用了 Mock 自动生成。

如需保持原有行为，选择以下方式之一：

#### 方式 1: 环境变量（推荐）

```bash
# .env
AUTO_COMPLETE_FUNCTIONS=true
```

#### 方式 2: CLI 参数

```bash
# 每次命令添加 --auto-complete
npx fn-orchestrator plan "需求" --auto-complete
```

#### 方式 3: Shell 别名

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
alias fno-plan='npx fn-orchestrator plan --auto-complete'

# 使用
fno-plan "你的需求"
```

---

## 配置架构

### ConfigManager 单例模式

v2.0 引入了集中式配置管理：

```typescript
// CLI 启动时初始化一次
ConfigManager.initialize(cliOptions);

// 所有业务代码使用
const config = ConfigManager.get();
```

**优势**:
- 单一配置来源
- 明确的优先级
- 集中验证
- 易于测试

### 配置加载流程

```
1. CLI 解析命令行参数
   ↓
2. preAction hook 触发
   ↓
3. ConfigManager.initialize()
   ├─ 调用 loadConfig()
   ├─ 加载环境变量（含 .env）
   ├─ 合并配置
   └─ 验证必需项
   ↓
4. 业务代码使用 ConfigManager.get()
```

---

## 参考资料

- [快速开始](./quickstart.md)
- [Mock 生成设计](./mock-generation-design.md)
- [环境变量模板](../.env.example)
- [API 文档](https://docs.anthropic.com/claude/reference/)
