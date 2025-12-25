import 'reflect-metadata';
import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { ToolProvider } from '../tools/interfaces/ToolProvider.js';
import { ToolFormatter } from '../tools/interfaces/ToolFormatter.js';
import type { ExecutionPlan, PlanResult } from './types.js';
import { IPlannerLLMClient, PlannerLLMClient } from './interfaces/IPlannerLLMClient.js';
import type { Planner } from './interfaces/IPlanner.js';
import { buildPlannerPrompt, parseLLMResponse } from './prompt.js';

/**
 * 函数编排规划器
 * Follows DIP: Depends on ToolProvider, ToolFormatter and IPlannerLLMClient abstractions
 * Follows LSP: Implements Planner interface for substitutability
 */
@injectable()
export class PlannerImpl implements Planner {
  constructor(
    @inject(ToolProvider) private toolProvider: ToolProvider,
    @inject(ToolFormatter) private toolFormatter: ToolFormatter,
    @inject(PlannerLLMClient) private llmClient: IPlannerLLMClient
  ) {}

  /**
   * 根据用户需求生成执行计划
   */
  async plan(userRequest: string): Promise<PlanResult> {
    try {
      const functionsDescription = this.buildFunctionsDescription();
      const plan = await this.callLLM(userRequest, functionsDescription);

      // 验证计划中的函数是否都存在
      if (plan.status === 'executable' && !this.validatePlan(plan)) {
        return {
          success: false,
          error: '计划中包含未注册的函数',
        };
      }

      return {
        success: true,
        plan,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '规划失败',
      };
    }
  }

  /**
   * 构建函数的描述信息（用于 LLM prompt）
   */
  private buildFunctionsDescription(): string {
    const tools = this.toolProvider.searchTools();
    return this.toolFormatter.formatForLLM(tools);
  }

  /**
   * 调用 LLM 生成计划
   */
  async callLLM(
    userRequest: string,
    functionsDescription: string
  ): Promise<ExecutionPlan> {
    const prompt = buildPlannerPrompt(userRequest, functionsDescription);
    const responseText = await this.llmClient.generatePlan(prompt);
    const parsed = parseLLMResponse(responseText);

    return {
      id: `plan-${uuidv4().slice(0, 8)}`,
      userRequest,
      steps: parsed.steps,
      missingFunctions: parsed.missingFunctions,
      createdAt: new Date().toISOString(),
      status: parsed.status,
    };
  }

  /**
   * 验证计划中的所有函数是否已注册
   */
  validatePlan(plan: ExecutionPlan): boolean {
    for (const step of plan.steps) {
      if (!this.toolProvider.hasTool(step.functionName)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 格式化计划用于 CLI 显示
   */
  formatPlanForDisplay(plan: ExecutionPlan): string {
    const lines: string[] = [];

    lines.push(`📋 执行计划 #${plan.id}`);
    lines.push(`用户需求: ${plan.userRequest}`);
    lines.push(`状态: ${plan.status === 'executable' ? '✅ 可执行' : '⚠️ 不完整'}`);
    lines.push('');

    if (plan.steps.length > 0) {
      lines.push('步骤:');
      for (const step of plan.steps) {
        const params = this.formatParameters(step.parameters);
        lines.push(`  Step ${step.stepId}: ${step.functionName}(${params})`);
        lines.push(`    → ${step.description}`);
      }
    }

    if (plan.missingFunctions && plan.missingFunctions.length > 0) {
      lines.push('');
      lines.push('⚠️ 缺少以下函数:');
      for (const fn of plan.missingFunctions) {
        lines.push(`  - ${fn.name}: ${fn.description}`);
        const params = fn.suggestedParameters
          .map((p) => `${p.name}: ${p.type}`)
          .join(', ');
        lines.push(`    参数: (${params})`);
        lines.push(`    返回: ${fn.suggestedReturns.type}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 格式化参数用于显示
   */
  private formatParameters(
    params: Record<string, { type: 'literal' | 'reference'; value: unknown }>
  ): string {
    return Object.entries(params)
      .map(([name, param]) => {
        if (param.type === 'reference') {
          return `${name}=\${${param.value}}`;
        }
        return `${name}=${JSON.stringify(param.value)}`;
      })
      .join(', ');
  }
}
