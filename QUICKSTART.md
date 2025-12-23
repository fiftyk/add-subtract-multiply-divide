# 使用 ANTHROPIC_AUTH_TOKEN 的快速开始

如果你已经在使用 Claude Code，那么你已经有了 `ANTHROPIC_AUTH_TOKEN` 环境变量。

## 快速测试

```bash
# 1. 列出可用的函数（自动使用 ./dist/functions/index.js）
npx fn-orchestrator list functions

# 2. 生成一个简单的计算计划（使用你现有的 ANTHROPIC_AUTH_TOKEN）
npx fn-orchestrator plan "计算 3 + 5"

# 3. 执行生成的计划（不需要 -f 参数）
npx fn-orchestrator execute <plan-id>
```

> 💡 **提示**: 现在不需要 `-f` 参数了！默认会自动使用 `./dist/functions/index.js`

## 完整示例

```bash
# 复杂计算：(10 - 3) * 2
npx fn-orchestrator plan "计算 (10 - 3) * 2"

# 查看所有计划
npx fn-orchestrator list plans

# 查看特定计划详情
npx fn-orchestrator show-plan <plan-id>

# 执行计划（带自动确认）
npx fn-orchestrator execute <plan-id> -y
```

## 缺口识别测试

尝试请求一个不存在的函数：

```bash
npx fn-orchestrator plan "计算 16 的平方根"
```

系统会提示缺少 `sqrt` 函数，并给出建议的函数定义。

## 环境变量优先级

系统会按以下顺序查找 API Key：
1. `ANTHROPIC_API_KEY`（优先）
2. `ANTHROPIC_AUTH_TOKEN`（Claude Code 兼容）

如果两者都设置了，会使用 `ANTHROPIC_API_KEY`。

## 自定义函数路径

如果你的函数在其他位置，使用 `-f` 参数指定：

```bash
npx fn-orchestrator list functions -f ./my-functions/index.js
npx fn-orchestrator plan "..." -f ./my-functions/index.js
npx fn-orchestrator execute <plan-id> -f ./my-functions/index.js
```
