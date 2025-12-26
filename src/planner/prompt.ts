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

const SYSTEM_PROMPT = `你是一个函数编排专家。根据用户需求，规划函数调用序列。

## 步骤类型

1. **function_call**: 调用已注册函数完成任务
2. **user_input**: 向用户收集信息（用于需求中缺失的必填参数）

## 任务

1. 先分析需求，判断是否需要用户输入
2. 再规划函数调用
3. 如果缺少必要函数，列出缺失函数定义

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
  "missingFunctions": [ { "name": "getWeather", "description": "获取指定城市指定日期的天气", "suggestedParameters": [ { "name": "city", "type": "string", "description": "城市名称" }, { "name": "date", "type": "string", "description": "日期 (YYYY-MM-DD)" } ], "suggestedReturns": { "type": "object", "description": "天气信息" } } ],
  "status": "incomplete"
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
