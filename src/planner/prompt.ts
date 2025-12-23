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

## 任务

请分析用户需求，生成一个执行计划。

1. 如果可以使用现有函数完成需求，请生成具体的调用计划
2. 如果需要的函数不存在，请识别出缺失的函数并给出建议的定义

## 输出格式

请以 JSON 格式输出，格式如下：

\`\`\`json
{
  "steps": [
    {
      "stepId": 1,
      "functionName": "函数名",
      "description": "这一步做什么",
      "parameters": {
        "参数名": {
          "type": "literal",
          "value": "具体值"
        }
      }
    },
    {
      "stepId": 2,
      "functionName": "函数名",
      "description": "这一步做什么",
      "parameters": {
        "参数名": {
          "type": "reference",
          "value": "step.1.result"
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
- 参数值可以是 "literal"（字面量）或 "reference"（引用前一步结果）
- 引用格式为 "step.{stepId}.result"
- 请确保输出的 JSON 格式正确，可以被解析`;
}

/**
 * 解析 LLM 响应
 */
export function parseLLMResponse(response: string): {
  steps: Array<{
    stepId: number;
    functionName: string;
    description: string;
    parameters: Record<string, { type: 'literal' | 'reference'; value: unknown }>;
    dependsOn?: number[];
  }>;
  missingFunctions?: Array<{
    name: string;
    description: string;
    suggestedParameters: Array<{ name: string; type: string; description: string }>;
    suggestedReturns: { type: string; description: string };
  }>;
  status: 'executable' | 'incomplete';
} {
  // 提取 JSON 块
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : response;

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('无法解析 LLM 响应为 JSON');
  }
}
