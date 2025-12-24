import Anthropic from '@anthropic-ai/sdk';
import type {
  PlanRefinementRequest,
  PlanRefinementResponse,
} from '../types.js';
import type { IPlanRefinementLLMClient } from '../interfaces/IPlanRefinementLLMClient.js';
import type { ExecutionPlan } from '../../planner/types.js';
import type { FunctionDefinition } from '../../registry/types.js';

/**
 * 使用 Claude API 实现 Plan 改进
 */
export class AnthropicPlanRefinementLLMClient implements IPlanRefinementLLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: {
    apiKey: string;
    baseURL?: string;
    model?: string;
    maxTokens?: number;
  }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096; // 改进需要更多 tokens
  }

  /**
   * 改进 Plan
   */
  async refinePlan(request: PlanRefinementRequest): Promise<PlanRefinementResponse> {
    const prompt = this.buildRefinementPrompt(request);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // 提取文本内容
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in LLM response');
    }

    // 解析 JSON 响应
    return this.parseResponse(textContent.text);
  }

  /**
   * 构建改进 prompt
   */
  private buildRefinementPrompt(request: PlanRefinementRequest): string {
    const {
      currentPlan,
      refinementInstruction,
      conversationHistory,
      availableFunctions,
    } = request;

    // 格式化函数列表
    const functionsDesc = this.formatFunctions(availableFunctions);

    // 格式化对话历史（最近 3 轮）
    const historyDesc = this.formatConversationHistory(
      conversationHistory.slice(-6) // 最近 3 轮对话（每轮 2 条消息）
    );

    return `你是一个执行计划改进专家。用户会提供：
1. 当前的执行计划（JSON 格式）
2. 自然语言的修改指令

你的任务：
1. **理解用户的修改意图**
2. **对执行计划进行相应的修改**
3. **输出改进后的完整执行计划（JSON 格式）**
4. **说明你做了哪些改动**

## 关键约束

- 步骤依赖必须保持有效（dependsOn 字段）
- 参数引用必须指向存在的步骤（如 \${step.1.result}）
- 函数名必须在可用函数列表中存在
- 步骤 ID 必须连续（1, 2, 3...）
- 修改后的 plan 必须仍然是有效且可执行的

## 当前执行计划

\`\`\`json
${JSON.stringify(currentPlan, null, 2)}
\`\`\`

## 可用函数列表

${functionsDesc}

${historyDesc ? `## 对话历史\n\n${historyDesc}\n` : ''}
## 用户的修改指令

"${refinementInstruction}"

## 输出格式

请严格按照以下 JSON 格式输出（不要添加任何其他文字）：

\`\`\`json
{
  "refinedPlan": {
    "id": "${currentPlan.id}",
    "userRequest": "...",
    "steps": [
      {
        "stepId": 1,
        "functionName": "...",
        "description": "...",
        "parameters": { ... },
        "dependsOn": [...]
      }
    ],
    "createdAt": "${currentPlan.createdAt}",
    "status": "executable"
  },
  "changes": [
    {
      "type": "step_modified",
      "stepId": 2,
      "description": "将第2步的函数从 add 改为 multiply",
      "before": { "functionName": "add", ... },
      "after": { "functionName": "multiply", ... }
    }
  ],
  "explanation": "根据你的要求，我做了以下修改：..."
}
\`\`\`

**重要**：
1. refinedPlan 必须是完整的 ExecutionPlan，包含所有步骤
2. changes 数组详细说明每个改动
3. explanation 用自然语言解释修改内容
4. 只输出 JSON，不要有其他内容`;
  }

  /**
   * 格式化函数列表
   */
  private formatFunctions(functions: FunctionDefinition[]): string {
    return functions
      .map((fn) => {
        const params = fn.parameters
          .map((p) => `  - ${p.name} (${p.type}): ${p.description}`)
          .join('\n');
        return `**${fn.name}**: ${fn.description}\n${params}\n返回: ${fn.returns.type} - ${fn.returns.description}`;
      })
      .join('\n\n');
  }

  /**
   * 格式化对话历史
   */
  private formatConversationHistory(messages: PlanRefinementRequest['conversationHistory']): string {
    if (messages.length === 0) {
      return '';
    }

    return messages
      .map((msg) => {
        const roleLabel = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
        return `[${roleLabel}]: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(text: string): PlanRefinementResponse {
    try {
      // 提取 JSON（可能被 ```json ``` 包裹）
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      const parsed = JSON.parse(jsonText);

      // 验证响应格式
      if (!parsed.refinedPlan || !parsed.changes || !parsed.explanation) {
        throw new Error('Invalid response format: missing required fields');
      }

      // 验证 refinedPlan 结构
      this.validateRefinedPlan(parsed.refinedPlan);

      return {
        refinedPlan: parsed.refinedPlan,
        changes: parsed.changes,
        explanation: parsed.explanation,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}\n\nResponse text: ${text.slice(0, 500)}`
      );
    }
  }

  /**
   * 验证改进后的 plan 结构
   */
  private validateRefinedPlan(plan: ExecutionPlan): void {
    if (!plan.id || !plan.steps || !Array.isArray(plan.steps)) {
      throw new Error('Invalid refined plan: missing id or steps');
    }

    if (plan.steps.length === 0) {
      throw new Error('Invalid refined plan: steps array is empty');
    }

    // 验证步骤 ID 连续性
    for (let i = 0; i < plan.steps.length; i++) {
      if (plan.steps[i].stepId !== i + 1) {
        throw new Error(
          `Invalid refined plan: step IDs must be consecutive (expected ${i + 1}, got ${plan.steps[i].stepId})`
        );
      }
    }

    // 验证依赖有效性
    for (const step of plan.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (depId >= step.stepId) {
            throw new Error(
              `Invalid refined plan: step ${step.stepId} depends on step ${depId}, but dependencies must be on earlier steps`
            );
          }
        }
      }
    }
  }
}
