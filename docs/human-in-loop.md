# 在计划（plan）设计中引入等待用户输入的机制 

目前我们输入需求时，llm 理解需求后如果没有可用工具会自己生成代码或者提示用户补充工具来完成需求。

但还有另外一类需求，比如“我想要查找任意公司持有的专利信息”，要为设计满足这种需求生成的规划，可能会在plan执行过程中向外部寻求输入，比如“请提供公司名称”，然后再继续执行后续步骤。寻求外部输入的步骤，可能存在于plan执行的任意位置。

为支持这种需求，我们需要在plan的设计中引入“等待用户输入”的机制。具体可以考虑以下几点：

1. **输入占位符**：在plan的步骤中，可以设计一种特殊的占位符，表示需要等待用户输入。例如，在步骤描述中使用“{等待用户输入: 公司名称}”来明确指出需要用户提供信息。
2. **异步执行**：plan的执行需要支持异步操作。当执行到需要用户输入的步骤时，系统应暂停执行，并将控制权交还给用户，等待用户提供所需信息后再继续执行后续步骤。

"等待用户输入"机制在不同形态的程序中形态也不一致，在 cli 程序中，可能是等待用户在终端输入数据，而在 web 程序中，可能是通过弹出对话框或表单让用户填写信息。统一接口设计下的具体实现可以根据不同的运行环境进行适配。

在web程序中，我希望可以支持和实现 [A2UI](https://a2ui.org/) 协议。 这个协议能用在 cli 端吗？感觉有可能。

---

## 实施计划

基于上述需求分析，我们制定了以下实施计划：

### 技术方案选择

- **协议**: 采用 A2UI 协议，支持 CLI 和未来的 Web 环境
- **范围**: 仅在 Executor 执行阶段支持用户输入
- **Schema 验证**: 使用 Zod 进行类型验证
- **架构原则**: SOLID 原则，最小侵入性，渐进式实施

### 实施阶段

#### 阶段 1: A2UI Schema 基础设施 (1-2 天)

**目标**: 建立 A2UI Schema 类型定义和验证机制

**交付物**:
- `src/user-input/interfaces/A2UISchema.ts` - A2UI Schema 接口定义
- `src/user-input/validation/schema-validator.ts` - Zod 验证器实现
- 单元测试 (覆盖率 > 80%)

**支持的字段类型**:
- text (文本输入)
- number (数字输入)
- boolean (是/否确认)
- single_select (单选)
- multi_select (多选)

**验证规则**:
- 必填检查
- 范围验证 (min/max)
- 长度验证 (min/max)
- 正则表达式验证
- 自定义错误消息

#### 阶段 2: CLI 适配器实现 (2-3 天)

**目标**: 实现 CLI 环境下的用户输入收集

**交付物**:
- `src/user-input/interfaces/UserInputProvider.ts` - 环境适配器接口
- `src/user-input/adapters/CLIUserInputProvider.ts` - CLI 实现 (基于 inquirer)
- 错误类型定义 (UserInputTimeoutError, UserInputCancelledError, UnsupportedFieldTypeError)
- 集成测试

**关键特性**:
- A2UI Schema 到 inquirer 的自动转换
- 验证失败时自动重试
- 超时控制支持
- 用户取消检测

#### 阶段 3: Executor 集成 (3-4 天)

**目标**: 端到端打通执行流程，支持用户输入步骤

**交付物**:
- 修改 `src/planner/types.ts` - 引入 StepType 枚举和 UserInputStep 类型
- 新增 `src/planner/type-guards.ts` - 类型守卫函数
- 修改 `src/executor/executor.ts` - 添加用户输入步骤处理逻辑
- 修改 `src/executor/context.ts` - 增强引用解析 (支持嵌套字段访问)
- 修改 `src/executor/types.ts` - StepResult 添加 metadata
- 更新 `src/container.ts` - 依赖注入配置
- E2E 测试

**关键特性**:
- 使用判别联合类型 (Discriminated Union) 保持向后兼容
- 支持嵌套字段引用 (如 `step.1.companyName`)
- 执行时检查字段类型支持 (fail-fast)
- 完整的执行结果持久化

### 示例用例

**场景**: "查找华为公司持有的专利"

**ExecutionPlan 结构**:
```json
{
  "steps": [
    {
      "stepId": 1,
      "type": "user_input",
      "description": "获取公司名称",
      "schema": {
        "version": "1.0",
        "fields": [{
          "id": "companyName",
          "type": "text",
          "label": "请输入公司名称",
          "required": true
        }]
      }
    },
    {
      "stepId": 2,
      "type": "function_call",
      "functionName": "searchPatents",
      "parameters": {
        "company": {
          "type": "reference",
          "value": "step.1.companyName"
        }
      }
    }
  ]
}
```

**CLI 执行流程**:
```
=== User Input Required ===
? 请输入公司名称
> 华为

✅ Step 1 completed (user_input) - 1 field collected
⏳ Step 2: searchPatents (company: 华为)
✅ Step 2 completed - Found 12,453 patents
```

### 未来扩展

- **阶段 4**: 条件显示、动态选项、跳过功能
- **阶段 5**: Planner 集成 - LLM 自动生成用户输入步骤
- **阶段 6**: Web 适配器 - WebSocket + React/Vue 组件

### 参考资源

- A2UI 协议: https://a2ui.org/
- Zod 文档: https://zod.dev/
- 完整设计文档: `/Users/liurongtao/.claude/plans/streamed-zooming-wall.md`