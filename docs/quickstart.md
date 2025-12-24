# 快速开始

5 分钟快速上手 fn-orchestrator。

## 前置要求

- Node.js 18+
- Anthropic API Key

## 第一步：配置 API Key

### 如果你已经在使用 Claude Code

恭喜！你已经有了 `ANTHROPIC_AUTH_TOKEN` 环境变量，可以直接跳到[第二步](#第二步列出可用函数)。

### 如果你还没有 API Key

1. 注册并获取 API Key: https://console.anthropic.com/settings/keys

2. 设置环境变量（三选一）：

   **方式 1: 直接导出**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-xxxxx"
   ```

   **方式 2: 使用 .env 文件（推荐）**
   ```bash
   # 复制模板
   cp .env.example .env

   # 编辑 .env 文件
   nano .env

   # 填入你的 API Key
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   ```

   **方式 3: Claude Code 兼容**
   ```bash
   export ANTHROPIC_AUTH_TOKEN="sk-ant-xxxxx"
   ```

---

## 第二步：列出可用函数

查看系统中已注册的函数：

```bash
npx fn-orchestrator list functions
```

**输出示例**:
```
📚 已注册的函数 (4 个):

- add: 将两个数字相加
  使用场景: 当需要计算两个数的和时使用
  参数:
    - a (number): 第一个加数
    - b (number): 第二个加数
  返回值: number - 两数之和

- subtract: 将两个数字相减
- multiply: 将两个数字相乘
- divide: 将两个数字相除
```

---

## 第三步：生成执行计划

使用自然语言描述你的需求：

```bash
npx fn-orchestrator plan "计算 3 + 5"
```

**输出示例**:
```
📝 正在分析需求...
用户需求: 计算 3 + 5

已加载 4 个函数: add, subtract, multiply, divide

✅ 计划生成成功！

📋 执行计划 #plan-abc123:
用户需求: 计算 3 + 5
状态: ✅ 可执行

步骤:
  Step 1: add(a=3, b=5)
    → 计算 3 + 5

执行命令: npx fn-orchestrator execute plan-abc123
```

---

## 第四步：执行计划

```bash
npx fn-orchestrator execute plan-abc123
```

或使用 `-y` 跳过确认：

```bash
npx fn-orchestrator execute plan-abc123 -y
```

**输出示例**:
```
🚀 开始执行...

执行结果 - 计划 #plan-abc123

✅ Step 1: add(a=3, b=5)
   → 结果: 8

📦 最终结果: 8
✅ 执行成功!
```

---

## 更多示例

### 复杂计算

```bash
# (10 - 3) * 2
npx fn-orchestrator plan "计算 (10 - 3) * 2"

# ((10 - 3) * 4) / 2
npx fn-orchestrator plan "计算 ((10 - 3) * 4) / 2"
```

### 查看所有计划

```bash
npx fn-orchestrator list plans
```

**输出示例**:
```
📋 执行计划列表 (3 个):

✅ plan-abc123 - 计算 3 + 5
   创建时间: 2025-12-24T10:00:00.000Z | 步骤数: 1
✅ plan-def456 - 计算 (10 - 3) * 2
   创建时间: 2025-12-24T10:05:00.000Z | 步骤数: 2
⚠️ plan-ghi789 - 计算 16 的平方根
   创建时间: 2025-12-24T10:10:00.000Z | 步骤数: 0
```

### 查看计划详情

```bash
npx fn-orchestrator show-plan plan-abc123
```

---

## Mock 自动生成（可选）

当你请求的功能需要尚未实现的函数时，系统可以自动生成 mock 实现。

### 默认行为（缺失函数提示）

```bash
npx fn-orchestrator plan "计算 16 的平方根"
```

**输出**:
```
⚠️ 无法完成此需求，缺少以下函数:

1. sqrt
   - 描述: 计算平方根
   - 参数: x (number)
   - 返回: number

💡 提示: 缺少 1 个函数
   使用 --auto-mock 标志可以自动生成缺失函数的 mock 实现
   或在环境变量中设置 AUTO_GENERATE_MOCK=true
```

### 启用 Mock 生成

**方式 1: CLI 参数（推荐用于临时测试）**
```bash
npx fn-orchestrator plan "计算 16 的平方根" --auto-mock
```

**方式 2: 环境变量（推荐用于开发环境）**
```bash
# 设置环境变量
export AUTO_GENERATE_MOCK=true

# 或在 .env 文件中
echo "AUTO_GENERATE_MOCK=true" >> .env

# 正常使用
npx fn-orchestrator plan "计算 16 的平方根"
```

**输出**:
```
📝 正在分析需求...

🔧 Generating mock implementations...
✅ Generated 1 mock function(s)

✅ 计划生成成功！

📋 执行计划 #plan-xyz789:
用户需求: 计算 16 的平方根
状态: ✅ 可执行

步骤:
  Step 1: sqrt(number=16)
    → 计算 16 的平方根

⚠️  此计划使用了 MOCK 数据，结果仅供测试
📁 Mock functions: sqrt
💡 提示: 编辑 functions/generated/ 中的文件来实现真实逻辑

执行命令: npx fn-orchestrator execute plan-xyz789
```

生成的 mock 函数保存在 `functions/generated/sqrt-{timestamp}.js`：

```javascript
// 🤖 AUTO-GENERATED MOCK FUNCTION
export const sqrt = defineFunction({
  name: 'sqrt',
  description: '计算一个数字的平方根',
  implementation: (number) => {
    // ⚠️ MOCK IMPLEMENTATION - 返回模拟数据
    return 3.162;  // 实际应该是 Math.sqrt(number)
  }
});
```

你可以编辑这个文件，替换为真实实现：

```javascript
implementation: (number) => {
  return Math.sqrt(number);  // 真实实现
}
```

---

## 自定义函数路径

如果你的函数在其他位置，使用 `-f` 参数指定：

```bash
npx fn-orchestrator list functions -f ./my-functions/index.js
npx fn-orchestrator plan "..." -f ./my-functions/index.js
npx fn-orchestrator execute <plan-id> -f ./my-functions/index.js
```

**默认路径**: `./dist/functions/index.js`

---

## 环境变量说明

### API Key 优先级

系统按以下顺序查找 API Key：

1. `ANTHROPIC_API_KEY` （优先）
2. `ANTHROPIC_AUTH_TOKEN` （Claude Code 兼容）

如果两者都设置了，会使用 `ANTHROPIC_API_KEY`。

### 配置优先级

完整的配置优先级顺序：

```
命令行参数 > 环境变量 > .env 文件 > 默认值
```

**示例**:
```bash
# 即使 .env 中设置 AUTO_GENERATE_MOCK=false
# CLI 参数仍会覆盖
npx fn-orchestrator plan "..." --auto-mock
```

---

## 常见问题

### 1. API Key 错误

**错误**:
```
❌ API key is required
```

**解决**:
```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY

# 如果为空，设置它
export ANTHROPIC_API_KEY="sk-ant-xxxxx"

# 或使用 .env 文件
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > .env
```

### 2. 没有找到函数

**错误**:
```
⚠️ 没有找到已注册的函数
```

**解决**:
```bash
# 确保已构建项目
npm run build

# 确认函数文件存在
ls -l ./dist/functions/index.js

# 或指定自定义路径
npx fn-orchestrator list functions -f ./path/to/functions.js
```

### 3. Mock 没有生成

**问题**: 使用 `--auto-mock` 但没有生成 mock

**检查**:
```bash
# 1. 确认 CLI 参数正确
npx fn-orchestrator plan "..." --auto-mock

# 2. 查看 debug 日志
LOG_LEVEL=debug npx fn-orchestrator plan "..." --auto-mock

# 3. 检查生成目录
ls -l functions/generated/
```

### 4. 执行超时

**错误**:
```
Step execution timed out after 30000ms
```

**解决**:
```bash
# 增加超时时间（毫秒）
export EXECUTOR_STEP_TIMEOUT=60000

# 或在 .env 中
echo "EXECUTOR_STEP_TIMEOUT=60000" >> .env
```

---

## 命令速查表

```bash
# 列出函数
npx fn-orchestrator list functions

# 生成计划
npx fn-orchestrator plan "<需求>"
npx fn-orchestrator plan "<需求>" --auto-mock
npx fn-orchestrator plan "<需求>" --auto-mock --mock-max-iterations 5

# 执行计划
npx fn-orchestrator execute <plan-id>
npx fn-orchestrator execute <plan-id> -y

# 查看计划
npx fn-orchestrator list plans
npx fn-orchestrator show-plan <plan-id>

# 自定义函数路径
npx fn-orchestrator list functions -f <path>
npx fn-orchestrator plan "<需求>" -f <path>
npx fn-orchestrator execute <plan-id> -f <path>
```

---

## 下一步

- 📖 [配置详解](./configuration.md) - 了解所有配置选项
- 🏗️ [Mock 生成设计](./mock-generation-design.md) - 深入理解 Mock 系统
- 🔧 [自定义函数](../README.md#自定义函数) - 创建自己的函数
- 📝 [完整 README](../README.md) - 查看完整文档
