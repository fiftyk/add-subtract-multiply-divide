import type { A2UISchema } from '../user-input/interfaces/A2UISchema.js';
import { StepType } from './types.js';

// Step type constants for validation
export const STEP_TYPE_FUNCTION_CALL = StepType.FUNCTION_CALL;
export const STEP_TYPE_USER_INPUT = StepType.USER_INPUT;

// ============================================================
// Types
// ============================================================

export type RawFunctionCallStep = {
  stepId: number;
  type: 'function_call';
  functionName: string;
  description: string;
  parameters: Record<string, { type: 'literal' | 'reference'; value: unknown }>;
  dependsOn?: number[];
};

export type RawUserInputStep = {
  stepId: number;
  type: 'user_input';
  description: string;
  schema: A2UISchema;
  outputName?: string;
};

export type RawPlanStep = RawFunctionCallStep | RawUserInputStep;

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

// ============================================================
// Prompt Templates
// ============================================================

const SYSTEM_PROMPT = `你是一个函数编排专家。你的核心职责是深入理解用户需求、设计合理的执行计划。

## 工作流程

### 第一步：需求理解与分析
- 仔细阅读用户需求，识别核心目标
- 分解需求为可执行的步骤
- 判断哪些信息需要向用户收集，哪些可以通过函数计算

### 第二步：函数匹配与规划
- 从可用函数列表中选择合适的函数
- 规划步骤顺序，处理步骤间的依赖关系
- 设计参数传递，确保数据正确流转

### 第三步：缺失函数识别
- 分析需求中哪些功能没有现有函数支持
- 为每个缺失函数设计完整的规格定义

## 步骤类型

1. **function_call**: 调用已注册函数完成任务
2. **user_input**: 向用户收集信息（可以在任意步骤，不仅仅是开始）

**用户输入的使用场景：**
- 需求开始时缺少必填信息（如"查询某公司专利"缺少公司名称）
- 执行过程中需要用户确认或选择（如让用户选择排序方式）
- 需要用户分步骤提供信息（如先问城市，再问日期）

**重要：用户输入可以在计划中的任何位置出现，可以有多次，不需要集中在第一步。**

## 输出格式

JSON 格式：
\`\`\`json
{ "steps": [...], "missingFunctions": [...], "status": "executable" | "incomplete" }
\`\`\``;

// 示例1：纯函数调用
const EXAMPLE_1_FUNCTION_CALL = `// 场景：计算 (3 + 5) * 2
{
  "steps": [
    { "stepId": 1, "type": "function_call", "functionName": "add", "description": "计算 3 + 5", "parameters": { "a": { "type": "literal", "value": 3 }, "b": { "type": "literal", "value": 5 } } },
    { "stepId": 2, "type": "function_call", "functionName": "multiply", "description": "乘以 2", "parameters": { "a": { "type": "reference", "value": "step.1.result" }, "b": { "type": "literal", "value": 2 } }, "dependsOn": [1] }
  ],
  "status": "executable"
}`;

// 示例2：需要用户输入
const EXAMPLE_2_USER_INPUT = `// 场景：查询某公司专利（公司名未知）
{
  "steps": [
    { "stepId": 1, "type": "user_input", "description": "询问公司名称", "schema": { "version": "1.0", "fields": [ { "id": "companyName", "type": "text", "label": "公司名称", "required": true } ] }, "outputName": "companyInfo" },
    { "stepId": 2, "type": "function_call", "functionName": "queryPatent", "description": "查询专利", "parameters": { "company": { "type": "reference", "value": "step.1.companyName" } }, "dependsOn": [1] }
  ],
  "status": "executable"
}`;

// 示例3：缺少函数
const EXAMPLE_3_MISSING_FUNCTION = `// 场景：查询天气（getWeather 未注册）
{
  "steps": [ { "stepId": 1, "type": "user_input", "description": "询问城市和日期", "schema": { "version": "1.0", "fields": [ { "id": "city", "type": "text", "label": "城市", "required": true }, { "id": "date", "type": "text", "label": "日期", "required": true } ] } } ],
  "missingFunctions": [ { "name": "getWeather", "description": "获取指定城市指定日期的天气信息，包括温度、湿度、天气状况、风力等", "suggestedParameters": [ { "name": "city", "type": "string", "description": "城市名称，支持中文或英文" }, { "name": "date", "type": "string", "description": "查询日期，格式 YYYY-MM-DD" } ], "suggestedReturns": { "type": "object", "description": "包含以下字段的对象：temperature(温度number)、humidity(湿度number)、condition(天气状况string，如晴/阴/雨/雪)、windLevel(风力等级number)" } } ],
  "status": "incomplete"
}`;

// 示例4：执行过程中需要用户输入（用户输入在中间步骤）
const EXAMPLE_4_USER_INPUT_IN_MIDDLE = `// 场景：用户需要先选择排序方式，再进行计算
{
  "steps": [
    { "stepId": 1, "type": "user_input", "description": "请选择排序方式", "schema": { "version": "1.0", "fields": [ { "id": "order", "type": "single_select", "label": "排序方式", "required": true, "config": { "options": ["升序", "降序"] } } ] } },
    { "stepId": 2, "type": "function_call", "functionName": "getUserData", "description": "获取用户数据列表", "parameters": {} },
    { "stepId": 3, "type": "function_call", "functionName": "sortData", "description": "根据用户选择的排序方式对数据排序", "parameters": { "data": { "type": "reference", "value": "step.2.result" }, "order": { "type": "reference", "value": "step.1.order" } }, "dependsOn": [1, 2] }
  ],
  "status": "executable"
}`;

// ============================================================
// Main Function
// ============================================================

export function buildPlannerPrompt(
  userRequest: string,
  functionsDescription: string
): string {
  return `${SYSTEM_PROMPT}

## 可用函数列表
${functionsDescription}

## 用户需求
${userRequest}

## 示例
示例1 - 纯函数调用:
${EXAMPLE_1_FUNCTION_CALL}

示例2 - 需要用户输入:
${EXAMPLE_2_USER_INPUT}

示例3 - 缺少函数:
${EXAMPLE_3_MISSING_FUNCTION}

示例4 - 用户输入在中间步骤:
${EXAMPLE_4_USER_INPUT_IN_MIDDLE}

请生成执行计划。`;
}

// ============================================================
// Response Parsing
// ============================================================

/**
 * Extract JSON block from LLM response
 */
function extractJSON(response: string): string {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  return jsonMatch ? jsonMatch[1] : response;
}

/**
 * Validate a single step
 */
function validateStep(step: unknown, stepId: number): void {
  const s = step as Record<string, unknown>;

  if (!s.type || ![STEP_TYPE_FUNCTION_CALL, STEP_TYPE_USER_INPUT].includes(s.type as StepType)) {
    throw new Error(`Invalid step: missing "type" field (stepId: ${stepId})`);
  }

  if (s.type === STEP_TYPE_FUNCTION_CALL) {
    if (!s.functionName) {
      throw new Error(`Invalid function_call step: missing "functionName" (stepId: ${stepId})`);
    }
    if (!s.parameters || typeof s.parameters !== 'object') {
      throw new Error(`Invalid function_call step: missing "parameters" (stepId: ${stepId})`);
    }
  }

  if (s.type === STEP_TYPE_USER_INPUT) {
    const schema = s.schema as Record<string, unknown> | undefined;
    if (!schema || typeof schema !== 'object') {
      throw new Error(`Invalid user_input step: missing "schema" (stepId: ${stepId})`);
    }
    const fields = schema.fields as unknown[];
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error(`Invalid user_input step: schema.fields must be non-empty (stepId: ${stepId})`);
    }
  }
}

/**
 * Validate parsed response structure
 */
function validateResponse(parsed: Record<string, unknown>): void {
  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error('Invalid LLM response: missing or invalid "steps" field');
  }

  if (!parsed.status || !['executable', 'incomplete'].includes(parsed.status as string)) {
    throw new Error('Invalid LLM response: missing or invalid "status" field');
  }

  for (const step of parsed.steps) {
    validateStep(step, (step as Record<string, number>).stepId);
  }
}

export function parseLLMResponse(response: string): ParsedLLMResponse {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    validateResponse(parsed);
    return parsed as ParsedLLMResponse;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('无法解析 LLM 响应为 JSON');
    }
    throw error;
  }
}
