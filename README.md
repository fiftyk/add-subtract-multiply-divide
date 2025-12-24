# add-subtract-multiply-divide

基于 LLM 的函数编排系统 - 通过自然语言描述需求，自动规划和执行函数调用链路。

## 特性

- 🤖 **智能规划**: 使用 Claude API 将自然语言需求转换为可执行的函数调用链
- 🔗 **链式执行**: 支持多步骤顺序执行，步骤间数据自动传递
- 🔍 **缺口识别**: 自动识别缺失的函数并生成建议的函数定义
- ⚡ **自动 Mock 生成**: 当缺少函数时，自动生成可执行的 mock 实现，让流程立即跑通
- ✅ **TDD 开发**: 59 个单元测试确保代码质量
- 📦 **持久化存储**: 计划和执行记录本地保存
- 🎯 **类型安全**: TypeScript 编写，完整的类型支持
- 🏗️ **SOLID 设计**: 遵循 SOLID 原则，易扩展易维护

## 📚 文档

- **[快速开始](./docs/quickstart.md)** - 5 分钟快速上手指南
- **[配置指南](./docs/configuration.md)** - 完整的配置选项说明
- **[Mock 生成设计](./docs/mock-generation-design.md)** - Mock 系统架构设计

## 安装

```bash
npm install
npm run build
```

## 快速配置

### 1. 设置 API Key（必需）

```bash
# 方式 1: 使用 ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY="your-api-key-here"

# 方式 2: 使用 ANTHROPIC_AUTH_TOKEN（Claude Code 兼容）
export ANTHROPIC_AUTH_TOKEN="your-api-key-here"
```

> 💡 如果你已经在使用 Claude Code，可以直接使用现有的 `ANTHROPIC_AUTH_TOKEN` 环境变量。

### 2. 创建 .env 文件（推荐）

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

### 3. 更多配置选项

完整的配置说明请参考：**[配置指南](./docs/configuration.md)**

包括：
- API 端点自定义
- Mock 自动生成控制
- 执行超时设置
- 日志级别配置
- 配置优先级说明

## 使用

> 💡 **提示**: 所有命令默认使用 `./dist/functions/index.js` 作为函数文件。如果你的函数在其他位置，使用 `-f` 参数指定路径。

### 1. 查看已注册的函数

```bash
npx fn-orchestrator list functions
```

输出示例：
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

### 2. 生成执行计划

```bash
npx fn-orchestrator plan "计算 (3 + 5) * 2"
```

输出示例：
```
📝 正在分析需求...
用户需求: 计算 (3 + 5) * 2

已加载 4 个函数: add, subtract, multiply, divide

✅ 计划生成成功！

📋 执行计划 #plan-abc123:
用户需求: 计算 (3 + 5) * 2
状态: ✅ 可执行

步骤:
  Step 1: add(a=3, b=5)
    → 先计算 3 + 5
  Step 2: multiply(a=${step.1.result}, b=2)
    → 将结果乘以 2

执行命令: npx fn-orchestrator execute plan-abc123
```

### 3. 执行计划

```bash
npx fn-orchestrator execute plan-abc123
```

输出示例：
```
📋 执行计划:
...

确认执行此计划? (y/n): y

🚀 开始执行...

执行结果 - 计划 #plan-abc123

✅ Step 1: add(a=3, b=5)
   → 结果: 8
✅ Step 2: multiply(a=8, b=2)
   → 结果: 16

📦 最终结果: 16
✅ 执行成功!
```

### 4. 查看所有计划

```bash
npx fn-orchestrator list plans
```

### 5. 查看计划详情

```bash
npx fn-orchestrator show-plan plan-abc123
```

## 自定义函数

在 `functions/` 目录下定义你自己的函数：

```typescript
import { defineFunction } from '../src/registry/index.js';

export const myFunction = defineFunction({
  name: 'myFunction',
  description: '函数功能描述',
  scenario: '使用场景说明',
  parameters: [
    { name: 'x', type: 'number', description: '参数说明' }
  ],
  returns: { type: 'number', description: '返回值说明' },
  implementation: (x: number) => {
    // 你的实现
    return x * 2;
  }
});
```

## 测试验证

### 运行所有测试

```bash
npm test
```

测试覆盖：
- ✅ 10 个 Registry 测试
- ✅ 6 个 Planner 测试
- ✅ 10 个 Executor 测试
- ✅ 8 个 Storage 测试
- ✅ 17 个 Mock 生成测试 (新增)
- ✅ 8 个端到端测试

**总计: 59 个测试，100% 通过率**

### 端到端测试用例

所有测试用例均已通过：

1. ✅ 计算 3 + 5 = 8
2. ✅ 计算 10 - 3 = 7
3. ✅ 计算 4 * 6 = 24
4. ✅ 计算 20 / 4 = 5
5. ✅ 计算 (3 + 5) * 2 = 16 (多步骤)
6. ✅ 计算 ((10 - 3) * 4) / 2 = 14 (链式调用)
7. ✅ 除数为 0 错误处理
8. ✅ 缺失函数识别

## 缺口识别示例

当尝试使用不存在的函数时：

```bash
npx fn-orchestrator plan "计算 9 的平方根"
```

系统会提示：
```
⚠️ 无法完成此需求，缺少以下函数:

1. sqrt
   - 描述: 计算平方根
   - 参数: x (number)
   - 返回: number
```

## 🆕 自动 Mock 生成功能

当系统识别到缺失函数时，可以自动使用 LLM 生成可执行的 mock 实现，让你的流程立即跑通。

### 快速启用

```bash
# 使用 --auto-mock 标志启用
npx fn-orchestrator plan "计算 16 的平方根" --auto-mock
```

系统会：
1. 🔍 识别缺失的函数（如 `sqrt`）
2. 🤖 自动生成 mock 实现
3. 💾 保存到 `functions/generated/` 目录
4. ✅ 生成可执行的计划

生成的 mock 文件可供后续完善（"悬赏模式"）。

### 了解更多

- **使用指南**: 参考 [快速开始](./docs/quickstart.md) 中的 Mock 生成示例
- **配置说明**: 参考 [配置指南](./docs/configuration.md) 了解如何启用和配置
- **技术设计**: 参考 [Mock 生成设计](./docs/mock-generation-design.md) 了解架构实现

## 项目结构

```
add-subtract-multiply-divide/
├── src/
│   ├── registry/          # 函数注册表
│   ├── planner/           # LLM 规划器
│   ├── executor/          # 执行引擎
│   ├── storage/           # 持久化存储
│   ├── mock/              # Mock 生成模块 (新增)
│   │   ├── interfaces/    # 接口定义
│   │   ├── implementations/ # 具体实现
│   │   ├── adapters/      # LLM 适配器
│   │   ├── decorators/    # Planner 装饰器
│   │   └── factory/       # 服务工厂
│   └── cli/               # CLI 命令
├── functions/             # 函数定义
│   ├── math.ts            # 数学函数（加减乘除）
│   └── generated/         # 自动生成的 Mock 函数
├── __tests__/             # 端到端测试
├── .data/                 # 本地数据存储
│   ├── plans/             # 执行计划
│   └── executions/        # 执行记录
└── package.json
```

## 架构设计

### 核心流程

```
用户需求 (自然语言)
    ↓
Planner (Claude API)
    ↓
执行计划 (JSON)
    ↓
用户确认
    ↓
Executor
    ↓
执行结果
```

### 关键模块

1. **Function Registry**: 管理函数的注册、查询和执行
2. **Planner**: 调用 Claude API，将自然语言转为结构化计划
3. **Executor**: 按计划顺序执行，处理步骤间数据传递
4. **Storage**: 持久化计划和执行记录到本地文件
5. **Mock Generator** (新增): 自动生成缺失函数的 mock 实现
6. **CLI**: 命令行交互界面

## 开发

### TDD 方式开发

本项目使用 TDD 方式开发，步骤：

1. 先写测试定义预期行为
2. 运行测试（应��失败）
3. 实现功能代码
4. 运行测试（应该通过）
5. 重构优化

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单次测试
npm run test:run

# 类型检查
npx tsc --noEmit
```

## 技术栈

- **语言**: TypeScript
- **LLM**: Claude API (Anthropic)
- **测试**: Vitest
- **CLI**: Commander.js
- **交互**: Inquirer.js
- **样式**: Chalk

## License

MIT
