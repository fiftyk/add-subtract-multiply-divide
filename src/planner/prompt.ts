import type { A2UISchema } from '../user-input/interfaces/A2UISchema.js';

/**
 * LLM 返回的原始步骤格式（函数调用步骤）
 */
export interface RawFunctionCallStep {
  stepId: number;
  type: 'function_call';
  functionName: string;
  description: string;
  parameters: Record<string, { type: 'literal' | 'reference'; value: unknown }>;
  dependsOn?: number[];
}

/**
 * LLM 返回的原始步骤格式（用户输入步骤）
 */
export interface RawUserInputStep {
  stepId: number;
  type: 'user_input';
  description: string;
  schema: A2UISchema;
  outputName?: string;
}

/**
 * LLM 返回的原始步骤（联合类型）
 */
export type RawPlanStep = RawFunctionCallStep | RawUserInputStep;

/**
 * LLM 响应的解析结果
 */
export interface ParsedLLMResponse {
  steps: RawPlanStep[];
  missingFunctions?: Array<{
    name: string;
    description: string;
    suggestedParameters: Array<{ name: string; type: string; description: string }>;
    suggestedReturns: { type: string; description: string };
  }>;
  status: 'executable' | 'incomplete';
}

/**
 * 生成规划 prompt
 */
export function buildPlannerPrompt(
  userRequest: string,
  functionsDescription: string
): string {
  return `你是一个函数编排专家。根据用户的需求，分析并规划出需要调用的函数序列。

## 可用函数列表

${functionsDescription}

## 用户需求

${userRequest}

## 步骤类型

执行计划支持两种类型的步骤：

### 1. 函数调用步骤 (function_call)

调用已注册的函数完成任务。

示例：
\`\`\`json
{
  "stepId": 1,
  "type": "function_call",
  "functionName": "add",
  "description": "计算 3 + 5",
  "parameters": {
    "a": { "type": "literal", "value": 3 },
    "b": { "type": "literal", "value": 5 }
  }
}
\`\`\`

### 2. 用户输入步骤 (user_input)

当需要从用户获取信息时使用此类型。系统会在执行过程中暂停，向用户展示表��收集输入。

**何时使用用户输入步骤：**
- 用户需求中有明确的未知信息需要询问（如"查询某公司的专利"中的公司名称）
- 需要用户确认或选择选项
- 需要收集结构化的用户数据

**不要使用用户输入步骤的情况��**
- 信息已经在用户需求中明确给出
- 可以通过函数计算得出的数据

用户输入步骤使用 A2UI Schema 定义表单结构：

\`\`\`json
{
  "stepId": 1,
  "type": "user_input",
  "description": "询问用户要查询的公司信息",
  "schema": {
    "version": "1.0",
    "fields": [
      {
        "id": "companyName",
        "type": "text",
        "label": "公司名称",
        "description": "请输入要查询的公司全称",
        "required": true,
        "validation": {
          "length": { "min": 2, "max": 100 }
        }
      },
      {
        "id": "year",
        "type": "number",
        "label": "年份",
        "description": "专利申请年份（可选）",
        "required": false,
        "validation": {
          "range": { "min": 1900, "max": 2099 }
        }
      }
    ]
  },
  "outputName": "companyInfo"
}
\`\`\`

**A2UI 字段类型：**
- \`text\`: 文本输入
- \`number\`: 数字输入
- \`boolean\`: 是/否选择
- \`single_select\`: 单选（需要在 config.options 中提供选项）
- \`multi_select\`: 多选（需要在 config.options 中提供选项）

**字段验证规则（validation）：**
- \`required\`: 是否必填（字段级别）
- \`range\`: 数字范围 { min, max }
- \`length\`: 文本长度 { min, max }
- \`pattern\`: 正则表达式（字符串）

**引用用户输入的值：**
后续步骤可以通过 \`step.{stepId}.{fieldId}\` 引用用户输入的特定字段：

\`\`\`json
{
  "stepId": 2,
  "type": "function_call",
  "functionName": "queryPatent",
  "parameters": {
    "company": { "type": "reference", "value": "step.1.companyName" },
    "year": { "type": "reference", "value": "step.1.year" }
  },
  "dependsOn": [1]
}
\`\`\`

## 任务

请分析用户需求，生成一个执行计划。

1. 如果需要向用户询问信息，先生成用户输入步骤
2. 如果可以使用现有函数完成需求，生成函数调用步骤
3. 如果需要的函数不存在，请识别出缺失的函数并给出建议的定义

## 输出格式

请以 JSON 格式输出，格式如下：

\`\`\`json
{
  "steps": [
    {
      "stepId": 1,
      "type": "user_input",
      "description": "询问用户...",
      "schema": { ... },
      "outputName": "可选的输出变量名"
    },
    {
      "stepId": 2,
      "type": "function_call",
      "functionName": "函数名",
      "description": "这一步做什么",
      "parameters": {
        "参数名": {
          "type": "reference",
          "value": "step.1.fieldId"
        }
      },
      "dependsOn": [1]
    }
  ],
  "missingFunctions": [
    {
      "name": "缺失的函数名",
      "description": "函数功能描述",
      "suggestedParameters": [
        {"name": "参数名", "type": "类型", "description": "描述"}
      ],
      "suggestedReturns": {"type": "类型", "description": "描述"}
    }
  ],
  "status": "executable 或 incomplete"
}
\`\`\`

注意：
- 如果可以完成需求，status 为 "executable"，steps 包含所有步骤
- 如果缺少必要函数，status 为 "incomplete"，missingFunctions 列出缺失的函数
- 每个步骤必须有 "type" 字段，值为 "function_call" 或 "user_input"
- 函数调用步骤的参数可以是 "literal"（字面量）或 "reference"（引用）
- 引用格式为 "step.{stepId}.result"（函数结果）或 "step.{stepId}.{fieldId}"（用户输入字段）
- 用户输入步骤的 schema.fields 数组至少要有一个字段
- 请确保输出的 JSON 格式正确，可以被解析`;
}

/**
 * 解析 LLM 响应
 *
 * 支持解析包含函数调用步骤和用户输入步骤的计划
 */
export function parseLLMResponse(response: string): ParsedLLMResponse {
  // 提取 JSON 块
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : response;

  try {
    const parsed = JSON.parse(jsonStr);

    // 验证基本结构
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid LLM response: missing or invalid "steps" field');
    }

    if (!parsed.status || !['executable', 'incomplete'].includes(parsed.status)) {
      throw new Error('Invalid LLM response: missing or invalid "status" field');
    }

    // 验证每个步骤都有 type 字段
    for (const step of parsed.steps) {
      if (!step.type || !['function_call', 'user_input'].includes(step.type)) {
        throw new Error(`Invalid step: missing or invalid "type" field (stepId: ${step.stepId})`);
      }

      // 验证函数调用步骤的必需字段
      if (step.type === 'function_call') {
        if (!step.functionName) {
          throw new Error(`Invalid function_call step: missing "functionName" (stepId: ${step.stepId})`);
        }
        if (!step.parameters || typeof step.parameters !== 'object') {
          throw new Error(`Invalid function_call step: missing or invalid "parameters" (stepId: ${step.stepId})`);
        }
      }

      // 验证用户输入步骤的必需字段
      if (step.type === 'user_input') {
        if (!step.schema || typeof step.schema !== 'object') {
          throw new Error(`Invalid user_input step: missing or invalid "schema" (stepId: ${step.stepId})`);
        }
        if (!step.schema.fields || !Array.isArray(step.schema.fields) || step.schema.fields.length === 0) {
          throw new Error(`Invalid user_input step: schema.fields must be a non-empty array (stepId: ${step.stepId})`);
        }
      }
    }

    return parsed as ParsedLLMResponse;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('无法解析 LLM 响应为 JSON');
    }
    throw error;
  }
}
