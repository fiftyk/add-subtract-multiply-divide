# A2UI v0.8 合规性重构计划

## 概述

将当前 A2UI 实现重构为符合 Google A2UI v0.8 官方规范。核心变更包括：

1. 使用 **BoundValue** 数据绑定（字面量值和路径引用）
2. 使用 **扁平邻接表** 结构描述组件（flat adjacency list）
3. 更新组件类型以匹配官方规范
4. 支持 `inputUI` 和 `resultUI` 在计划 JSON 中定义

## 当前状态 vs 目标状态

### 当前问题

| 问题 | 当前实现 | A2UI v0.8 规范 |
|------|----------|----------------|
| 数据绑定 | `label: string` | `label: { literalString: "value" }` |
| 数据绑定 | `text: string` | `text: { literalString: "text" }` 或 `{ path: "/data/path" }` |
| 组件引用 | `name: "fieldId"` | `selections: { path: "/stepX/input/fieldId" }` |
| 静态选项 | 内联选项数组 | `options: { path: "/data/list" }` |
| 组件类型 | `SelectField`, `DateField` | `MultipleChoice`, `DateTimeInput` |

## 详细变更计划

### 1. 更新 `src/a2ui/types.ts`

#### 1.1 添加 BoundValue 类型

```typescript
// ================ BoundValue (A2UI 核心) ================

/**
 * A2UI 绑定值 - 支持字面量和路径引用
 * 用于所有需要动态数据的属性
 */
export type BoundValue =
  | { literalString: string }
  | { path: string }
  | { literalNumber: number }
  | { literalBoolean: boolean };

// 便捷类型别名
export type TextValue = { literalString: string } | { path: string };
export type NumberValue = { literalNumber: number } | { path: string };
export type BooleanValue = { literalBoolean: boolean } | { path: string };
```

#### 1.2 更新组件 Props 使用 BoundValue

```typescript
// 更新前
export interface TextProps {
  text: string;
  style?: 'default' | 'heading' | 'subheading' | 'caption' | 'code';
}

// 更新后
export interface TextProps {
  text: TextValue;
  usageHint?: { literalString: 'default' | 'heading' | 'subheading' | 'caption' | 'code' };
}

export interface TextFieldProps {
  label: TextValue;
  text: { path: string };  // 输入绑定到路径
  placeholder?: TextValue;
  required?: BooleanValue;
  multiline?: BooleanValue;
  textFieldType?: { literalString: 'shortText' | 'longText' | 'number' | 'email' | 'password' };
}

export interface MultipleChoiceProps {
  label: TextValue;
  selections: { path: string };           // 用户选择存储路径
  options: { path: string } | { explicitList: Array<{ label: string; value: string }> };
  optionLabel?: string;                    // 选项对象中用作标签的字段名
  optionValue?: string;                    // 选项对象中用作值的字段名
  maxAllowedSelections?: NumberValue;
  minAllowedSelections?: NumberValue;
}

export interface TableProps {
  headers: TextValue[];
  rows: { path: string };                  // 表格数据路径
}

export interface DateTimeInputProps {
  label: TextValue;
  datetime: { path: string };              // 日期时间存储路径
  minDatetime?: { literalString: string };
  maxDatetime?: { literalString: string };
}
```

### 2. 重构 `src/a2ui/A2UIService.ts`

#### 2.1 添加 BoundValue 解析器

```typescript
/**
 * 解析 BoundValue 为实际值
 * @param boundValue - BoundValue 对象
 * @param context - 数据上下文（执行上下文）
 * @returns 解析后的实际值
 */
function resolveBoundValue(
  boundValue: BoundValue,
  context: Record<string, unknown>
): unknown {
  if ('literalString' in boundValue) return boundValue.literalString;
  if ('literalNumber' in boundValue) return boundValue.literalNumber;
  if ('literalBoolean' in boundValue) return boundValue.literalBoolean;
  if ('path' in boundValue) {
    return this.resolvePath(boundValue.path, context);
  }
  return undefined;
}

/**
 * 解析路径引用（如 "/step2/result/docs"）
 */
private resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split('/').filter(p => p);
  let current: unknown = context;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}
```

### 3. 更新渲染器

#### 3.1 CLI 渲染器 (`src/a2ui/adapters/CLIRenderer.ts`)

- 更新 `renderText` 支持 BoundValue
- 更新 `renderTextField` 使用 selections 路径
- 添加 `renderMultipleChoice` 替代 `renderSelectField`
- 添加 `renderDateTimeInput` 替代 `renderDateField`
- 更新 `renderTable` 使用 rows 路径

#### 3.2 Web 渲染器 (`web-server/src/services/WebA2UIRenderer.ts`)

- 添加 BoundValue 解析
- 生成适合 Vue/React 前端的 props
- 通过 SSE 发送完整组件定义

### 4. 更新执行器 (`src/executor/implementations/ExecutorImpl.ts`)

#### 4.1 支持 `inputUI`

```typescript
interface UserInputStep extends BasePlanStep {
  type: StepType.USER_INPUT;

  /** A2UI Schema (保持向后兼容) */
  schema?: A2UISchema;

  /**
   * A2UI 输入界面定义
   * 使用扁平邻接表结构
   */
  inputUI?: {
    surfaceId: string;
    root: string;
    components: A2UIComponent[];
  };
}
```

#### 4.2 执行器逻辑变更

```typescript
protected async executeUserInput(
  step: UserInputStep,
  context: ExecutionContext
): Promise<UserInputResult> {
  // 如果有 inputUI，使用 inputUI 渲染
  if (step.inputUI) {
    return this.executeUserInputWithUI(step, context);
  }
  // 否则回退到 schema 模式
  return this.executeUserInputWithSchema(step, context);
}

private async executeUserInputWithUI(
  step: UserInputStep,
  context: ExecutionContext
): Promise<UserInputResult> {
  const surfaceId = step.inputUI.surfaceId;

  // 1. 初始化渲染表面
  this.a2uiRenderer.begin(surfaceId, step.inputUI.root);

  // 2. 发送所有组件
  this.a2uiRenderer.update(surfaceId, step.inputUI.components);

  // 3. 查找输入组件并请求输入
  const inputComponent = this.findInputComponent(step.inputUI);
  const action = await this.a2uiRenderer.requestInput(surfaceId, inputComponent.id);

  // 4. 清理
  this.a2uiRenderer.end(surfaceId);

  // 5. 从 action.payload 提取输入值
  const values = this.extractInputValues(action.payload, step.inputUI);

  return {
    stepId: step.stepId,
    type: StepType.USER_INPUT,
    values,
    success: true,
    timestamp: Date.now(),
  };
}
```

#### 4.3 支持 `resultUI`

```typescript
interface FunctionCallStep extends BasePlanStep {
  type: StepType.FUNCTION_CALL;
  functionName: string;
  parameters: Record<string, ParameterValue>;

  /**
   * A2UI 结果界面定义
   * 用于展示函数调用结果
   */
  resultUI?: {
    surfaceId: string;
    root: string;
    components: A2UIComponent[];
  };
}
```

### 5. 更新计划类型定义

#### 5.1 扩展 `UserInputStep`

```typescript
export interface UserInputStep extends BasePlanStep {
  type: StepType.USER_INPUT;

  /** A2UI Schema (旧方式，保留兼容性) */
  schema?: A2UISchema;

  /**
   * A2UI 输入界面定义 (新方式)
   * 优先级高于 schema
   */
  inputUI?: {
    surfaceId: string;
    root: string;
    components: Array<{
      id: string;
      component: Record<string, Record<string, unknown>>;
    }>;
  };
}
```

#### 5.2 扩展 `FunctionCallStep`

```typescript
export interface FunctionCallStep extends BasePlanStep {
  type: StepType.FUNCTION_CALL;
  functionName: string;
  parameters: Record<string, ParameterValue>;

  /**
   * A2UI 结果界面定义
   * 用于展示函数调用结果
   */
  resultUI?: {
    surfaceId: string;
    root: string;
    components: Array<{
      id: string;
      component: Record<string, Record<string, unknown>>;
    }>;
  };
}
```

## 示例：专利研究计划

```json
{
  "stepId": 1,
  "type": "user_input",
  "description": "收集用户输入：技术关键词和查询数量",
  "inputUI": {
    "surfaceId": "step1-input",
    "root": "input-form",
    "components": [
      {
        "id": "input-title",
        "component": {
          "Text": {
            "text": { "literalString": "请输入专利搜索参数" },
            "usageHint": { "literalString": "subheading" }
          }
        }
      },
      {
        "id": "keyword-field",
        "component": {
          "TextField": {
            "label": { "literalString": "技术关键词" },
            "text": { "path": "/step1/input/keyword" },
            "textFieldType": { "literalString": "shortText" }
          }
        }
      },
      {
        "id": "rows-field",
        "component": {
          "TextField": {
            "label": { "literalString": "查询数量" },
            "text": { "path": "/step1/input/rows" },
            "textFieldType": { "literalString": "number" }
          }
        }
      },
      {
        "id": "input-form",
        "component": {
          "Column": {
            "children": { "explicitList": ["input-title", "keyword-field", "rows-field"] }
          }
        }
      }
    ]
  }
}
```

## 实施步骤

1. **类型定义阶段**
   - 更新 `src/a2ui/types.ts` 添加 BoundValue 类型
   - 更新组件 Props 使用 BoundValue
   - 添加新组件类型（MultipleChoice, DateTimeInput）

2. **服务层阶段**
   - 重构 `A2UIService` 添加 BoundValue 解析
   - 更新高阶方法返回 BoundValue

3. **渲染器阶段**
   - 更新 CLI 渲染器支持 BoundValue
   - 更新 Web 渲染器支持 BoundValue
   - 添加新组件渲染逻辑

4. **执行器阶段**
   - 更新 `ExecutorImpl` 支持 inputUI 和 resultUI
   - 添加 UI 驱动的输入收集逻辑
   - 保持 schema 模式向后兼容

5. **测试阶段**
   - 添加 BoundValue 解析测试
   - 添加渲染器测试
   - 添加执行器集成测试
   - 端到端测试（专利研究计划）

## 向后兼容性

- 保留 `schema` 字段作为后备
- 保留旧的组件类型名称作为别名
- 旧计划文件无需修改即可工作
- 新计划文件可使用新的 inputUI/resultUI 格式

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `src/a2ui/types.ts` | 添加 BoundValue，更新组件 Props |
| `src/a2ui/A2UIService.ts` | 添加 BoundValue 解析方法 |
| `src/a2ui/adapters/CLIRenderer.ts` | 支持 BoundValue，新组件类型 |
| `web-server/src/services/WebA2UIRenderer.ts` | 支持 BoundValue |
| `src/planner/types.ts` | 扩展 UserInputStep 和 FunctionCallStep |
| `src/executor/implementations/ExecutorImpl.ts` | 支持 inputUI/resultUI |
| `src/executor/session/types.ts` | 更新相关类型定义 |
| `src/cli/commands/execute.ts` | 支持新格式 |

## 验证步骤

1. 运行单元测试：`npm test`
2. 运行端到端测试：`npm run test:e2e`
3. 执行专利研究计划验证 UI 渲染
4. 验证 CLI 和 Web 两种模式
