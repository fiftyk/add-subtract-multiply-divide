import 'reflect-metadata';
import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { ToolSelector } from '../tools/interfaces/ToolSelector.js';
import { ToolFormatter } from '../tools/interfaces/ToolFormatter.js';
import type { ExecutionPlan, PlanResult, PlanStep } from './types.js';
import { StepType } from './types.js';
import { isFunctionCallStep, isConditionalStep } from './type-guards.js';
import { PlannerLLMClient } from './interfaces/PlannerLLMClient.js';
import type { Planner } from './interfaces/IPlanner.js';
import { buildPlannerPrompt, parseLLMResponse, type RawPlanStep } from './prompt.js';

/**
 * 函数编排规划器
 * Follows DIP: Depends on FunctionProvider, ToolSelector, ToolFormatter and PlannerLLMClient abstractions
 * Follows LSP: Implements Planner interface for substitutability
 */
@injectable()
export class PlannerImpl implements Planner {
  constructor(
    @inject(FunctionProvider) private functionProvider: FunctionProvider,
    @inject(ToolSelector) private toolSelector: ToolSelector,
    @inject(ToolFormatter) private toolFormatter: ToolFormatter,
    @inject(PlannerLLMClient) private llmClient: PlannerLLMClient
  ) {}

  /**
   * 根据用户需求生成执行计划
   */
  async plan(userRequest: string): Promise<PlanResult> {
    try {
      // 1. 选择工具
      const selectedTools = await this.toolSelector.selectTools(
        userRequest,
        this.functionProvider
      );

      // 2. 构建函数描述
      const functionsDescription = this.toolFormatter.formatForLLM(selectedTools);

      // 3. 调用 LLM 生成计划
      const plan = await this.callLLM(userRequest, functionsDescription);

      // 4. 验证计划中的函数是否都已注册（支持动态生成的函数）
      if (plan.status === 'executable' && !(await this.validatePlan(plan))) {
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
   * 调用 LLM 生成计划
   */
  async callLLM(
    userRequest: string,
    functionsDescription: string
  ): Promise<ExecutionPlan> {
    const prompt = buildPlannerPrompt(userRequest, functionsDescription);
    const responseText = await this.llmClient.generatePlan(prompt);
    const parsed = parseLLMResponse(responseText);

    // 将解析的原始步骤转换为 PlanStep 格式
    const steps: PlanStep[] = parsed.steps.map((rawStep) =>
      this.convertRawStep(rawStep)
    );

    return {
      id: `plan-${uuidv4().slice(0, 8)}`,
      userRequest,
      steps,
      missingFunctions: parsed.missingFunctions,
      createdAt: new Date().toISOString(),
      status: parsed.status,
    };
  }

  /**
   * 将 LLM 返回的原始步骤转换为类型化的 PlanStep
   */
  private convertRawStep(rawStep: RawPlanStep): PlanStep {
    if (rawStep.type === 'function_call') {
      // 转换为 FunctionCallStep
      return {
        stepId: rawStep.stepId,
        type: StepType.FUNCTION_CALL,
        functionName: rawStep.functionName,
        description: rawStep.description,
        parameters: rawStep.parameters,
        dependsOn: rawStep.dependsOn,
      };
    } else if (rawStep.type === 'user_input') {
      // 转换为 UserInputStep
      return {
        stepId: rawStep.stepId,
        type: StepType.USER_INPUT,
        description: rawStep.description,
        schema: rawStep.schema,
        outputName: rawStep.outputName,
      };
    } else {
      // 转换为 ConditionalStep
      return {
        stepId: rawStep.stepId,
        type: StepType.CONDITION,
        description: rawStep.description,
        condition: rawStep.condition,
        onTrue: rawStep.onTrue,
        onFalse: rawStep.onFalse,
        outputVariable: rawStep.outputVariable,
      };
    }
  }

  /**
   * 验证计划中的所有函数是否已注册
   * 查询 FunctionProvider 以支持运行时动态注册的函数（如 mock 生成）
   * @param plan - 要验证的执行计划
   * @returns 验证是否通过
   */
  private async validatePlan(plan: ExecutionPlan): Promise<boolean> {
    for (const step of plan.steps) {
      // 只验证函数调用步骤，用户输入步骤不需要验证
      if (isFunctionCallStep(step)) {
        if (!(await this.functionProvider.has(step.functionName))) {
          return false;
        }
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
        if (isFunctionCallStep(step)) {
          const params = this.formatParameters(step.parameters);
          lines.push(`  Step ${step.stepId}: ${step.functionName}(${params})`);
          lines.push(`    → ${step.description}`);
        } else if (isConditionalStep(step)) {
          // 条件步骤
          lines.push(`  Step ${step.stepId}: [Condition] ${step.condition}`);
          lines.push(`    → ${step.description}`);
        } else {
          // 用户输入步骤
          lines.push(`  Step ${step.stepId}: [User Input]`);
          lines.push(`    → ${step.description}`);
        }
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
