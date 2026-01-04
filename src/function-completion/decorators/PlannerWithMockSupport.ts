import type { Planner } from '../../planner/interfaces/IPlanner.js';
import type { CompletionOrchestrator } from '../interfaces/CompletionOrchestrator.js';
import type { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import type { PlanResult, MockFunctionReference, PlanStep, FunctionCallStep, MissingFunction, ExecutionPlan } from '../../planner/types.js';
import type { ILogger } from '../../logger/index.js';
import type { FunctionCompletionConfig, ReturnFieldRef } from '../types.js';
import type { FunctionDefinition } from '../../registry/types.js';
import { LoggerFactory } from '../../logger/index.js';

/**
 * Simplified function definition for signature matching
 */
interface SignatureDefinition {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns: {
    type: string;
    description: string;
  };
}

/**
 * Check if generated mock functions match the expected missing function specs
 * Returns true if all missing functions were generated with matching signatures
 */
function areSignaturesMatching(
  missingFunctions: MissingFunction[],
  generatedDefinitions: SignatureDefinition[]
): { match: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  // Create a map of generated function names to their definitions
  const generatedMap = new Map<string, SignatureDefinition>();
  for (const def of generatedDefinitions) {
    generatedMap.set(def.name, def);
  }

  // Check each missing function
  for (const missing of missingFunctions) {
    const generated = generatedMap.get(missing.name);

    // Function must be generated
    if (!generated) {
      mismatches.push(`${missing.name}: 函数未生成`);
      continue;
    }

    // Check parameter names match (order doesn't matter for our use case)
    const missingParamNames = new Set(missing.suggestedParameters.map(p => p.name));
    const generatedParamNames = new Set(generated.parameters.map(p => p.name));

    // All missing params should exist in generated
    for (const paramName of missingParamNames) {
      if (!generatedParamNames.has(paramName)) {
        mismatches.push(`${missing.name}: 期望参数 "${paramName}" 但生成的函数没有`);
      }
    }

    // Check return type matches
    const missingReturnType = missing.suggestedReturns.type;
    const generatedReturnType = generated.returns.type;

    // Normalize return types for comparison (e.g., 'object' vs 'Object')
    const normalizeType = (t: string) => t.toLowerCase();
    if (normalizeType(missingReturnType) !== normalizeType(generatedReturnType)) {
      mismatches.push(`${missing.name}: 返回类型期望 "${missingReturnType}" 但生成的是 "${generatedReturnType}"`);
    }
  }

  return { match: mismatches.length === 0, mismatches };
}

/**
 * Extract referenced return fields from plan steps for each missing function
 * Looks for references like ${step.1.result.inventor} or ${step.1.fieldName}
 */
function extractReferencedFields(
  steps: PlanStep[],
  missingFunctionNames: string[]
): Record<string, ReturnFieldRef[]> {
  const result: Record<string, ReturnFieldRef[]> = {};

  // Build a map of stepId -> functionName for function_call steps
  const stepToFunction: Map<number, string> = new Map();
  for (const step of steps) {
    if (step.type === 'function_call') {
      stepToFunction.set(step.stepId, step.functionName);
    }
  }

  // Track which fields are referenced from each missing function
  const fieldReferences: Map<string, Set<string>> = new Map();

  // Parse each step's parameters for references to missing function results
  for (const step of steps) {
    if (step.type !== 'function_call') continue;

    const funcName = step.functionName;

    // Only look at steps that call functions (not user_input)
    const parameters = (step as FunctionCallStep).parameters;
    if (!parameters) continue;

    // Check each parameter for references to missing functions
    for (const param of Object.values(parameters)) {
      if (param.type !== 'reference') continue;

      const refValue = param.value as string;
      // Parse reference format: step.{stepId}.{fieldPath}
      const match = refValue.match(/^step\.(\d+)\.(.+)$/);
      if (!match) continue;

      const referencedStepId = parseInt(match[1], 10);
      const referencedField = match[2]; // e.g., "result.inventor" or just "inventor"

      // Check if the referenced step calls a missing function
      const referencedFuncName = stepToFunction.get(referencedStepId);
      if (!referencedFuncName || !missingFunctionNames.includes(referencedFuncName)) {
        continue;
      }

      // Extract the actual field path (remove "result." prefix if present)
      const fieldPath = referencedField.startsWith('result.')
        ? referencedField.slice(7) // Remove "result."
        : referencedField;

      if (!fieldReferences.has(referencedFuncName)) {
        fieldReferences.set(referencedFuncName, new Set());
      }
      fieldReferences.get(referencedFuncName)!.add(fieldPath);
    }
  }

  // Convert to result format
  for (const [funcName, fields] of fieldReferences) {
    result[funcName] = Array.from(fields).map((path) => ({
      path,
      description: `Referenced in plan as \${step.N.${path}}`,
    }));
  }

  return result;
}

/**
 * Decorator for Planner that adds automatic mock generation support
 * Follows Decorator Pattern: Extends behavior without modifying the original class
 * Follows OCP: Open for extension (via decoration), closed for modification
 */
export class PlannerWithMockSupport {
  private logger: ILogger;
  private config: FunctionCompletionConfig;

  constructor(
    private basePlanner: Planner,
    private mockOrchestrator: CompletionOrchestrator,
    private functionProvider: FunctionProvider,
    config: FunctionCompletionConfig,
    logger?: ILogger
  ) {
    this.logger = logger ?? LoggerFactory.create();
    this.config = config;
  }

  /**
   * 格式化计划用于显示（委托给基础 planner）
   */
  formatPlanForDisplay(plan: ExecutionPlan): string {
    return this.basePlanner.formatPlanForDisplay(plan);
  }

  /**
   * Plan with automatic mock generation for missing functions
   * Supports iterative mock generation until plan is complete or max iterations reached
   */
  async plan(userRequest: string): Promise<PlanResult> {
    let iteration = 0;
    const allGeneratedMocks: MockFunctionReference[] = []; // Track all generated mock functions with versions

    while (iteration < this.config.maxIterations) {
      iteration++;

      // Only show iteration message after the first iteration
      if (iteration > 1) {
        this.logger.info(`\n${'─'.repeat(40)}`);
        this.logger.info(`🔄 第 ${iteration} 轮迭代生成...`);
        this.logger.info(`${'─'.repeat(40)}`);
      }

      // 1. Try planning
      let result = await this.basePlanner.plan(userRequest);

      // 2. If planning failed, return immediately
      if (!result.success) {
        return result;
      }

      // 3. If plan is complete, add metadata and return
      if (result.plan?.status === 'executable') {
        if (allGeneratedMocks.length > 0 && result.plan) {
          result.plan.metadata = {
            usesMocks: true,
            mockFunctions: allGeneratedMocks,
          };
        }
        return result;
      }

      // 4. If plan is incomplete and has missing functions, generate mocks
      if (
        result.plan?.status === 'incomplete' &&
        result.plan.missingFunctions &&
        result.plan.missingFunctions.length > 0
      ) {
        // Explain WHY: Plan is incomplete due to missing functions
        this.logger.warn(
          `\n⚠️  计划不完整：缺少 ${result.plan.missingFunctions.length} 个函数`
        );

        // Explain WHAT: List the missing functions to be generated
        this.logger.info('\n📝 缺少的函数:');
        result.plan.missingFunctions.forEach((fn, index) => {
          this.logger.info(`  ${index + 1}. ${fn.name}`);
          if (fn.description) {
            this.logger.info(`     描述: ${fn.description}`);
          }
        });

        // Now generate mocks
        this.logger.info('\n📝 正在生成 mock 实现...');

        // Extract referenced fields from plan steps
        const missingFunctionNames = result.plan.missingFunctions.map(fn => fn.name);
        const referencedFields = extractReferencedFields(result.plan.steps, missingFunctionNames);

        // Log referenced fields for debugging
        for (const [funcName, fields] of Object.entries(referencedFields)) {
          this.logger.info(`  📝 ${funcName} 引用字段: ${fields.map(f => f.path).join(', ')}`);
        }

        const mockResult =
          await this.mockOrchestrator.generateAndRegisterMocks(
            result.plan.missingFunctions,
            referencedFields
          );

        if (mockResult.success && mockResult.generatedFunctions.length > 0) {
          // Track generated mocks with version information
          for (const mockMeta of mockResult.generatedFunctions) {
            // Extract version from filePath (format: .../mocks/functionName-v1.js)
            const match = mockMeta.filePath.match(/\/([^/]+)-v(\d+)\.js$/);
            const version = match ? parseInt(match[2], 10) : 1;
            const relativePath = mockMeta.filePath.includes('/mocks/')
              ? `mocks/${mockMeta.functionName}-v${version}.js`
              : mockMeta.filePath;

            allGeneratedMocks.push({
              name: mockMeta.functionName,
              version,
              filePath: relativePath,
              generatedAt: mockMeta.generatedAt,
            });
          }

          this.logger.info(
            `\n📝 当前 registry 中共有 ${(await this.functionProvider.list()).length} 个函数`
          );

          // Optimization: Check if we can skip re-planning
          const allMissingGenerated = mockResult.generatedFunctions.length === result.plan.missingFunctions.length;
          const signatureCheck = allMissingGenerated && mockResult.generatedDefinitions
            ? areSignaturesMatching(result.plan.missingFunctions, mockResult.generatedDefinitions)
            : { match: false, mismatches: [] };

          if (allMissingGenerated && signatureCheck.match) {
            this.logger.info('\n✨ 签名匹配，跳过重新规划，直接更新计划状态');

            // Update the plan status directly without re-planning
            if (result.plan) {
              result.plan.status = 'executable';
              result.plan.metadata = {
                usesMocks: true,
                mockFunctions: allGeneratedMocks,
              };
            }
            return result;
          }

          // Signatures don't match or not all functions generated, need to re-plan
          if (!allMissingGenerated) {
            this.logger.info('\n📝 部分函数生成失败，继续重新规划...');
          } else if (!signatureCheck.match) {
            this.logger.info('\n📝 签名不匹配，需要重新规划以调整调用方式');
            for (const mismatch of signatureCheck.mismatches) {
              this.logger.info(`  ⚠️  ${mismatch}`);
            }
          } else {
            this.logger.info('\n📝 继续重新规划...');
          }

          // Continue to next iteration to re-plan
          continue;
        } else {
          // All functions failed to generate in this iteration
          this.logger.error(`\n❌ 本轮 mock 函数生成全部失败`);

          // If we have generated some mocks in previous iterations, add metadata
          if (allGeneratedMocks.length > 0 && result.plan) {
            result.plan.metadata = {
              usesMocks: true,
              mockFunctions: allGeneratedMocks,
            };
          }

          // Return the incomplete plan with error info
          return result;
        }
      }

      // If we reach here, something unexpected happened, return current result
      if (allGeneratedMocks.length > 0 && result.plan) {
        result.plan.metadata = {
          usesMocks: true,
          mockFunctions: allGeneratedMocks,
        };
      }
      return result;
    }

    // Max iterations reached, do a final plan
    this.logger.warn(`\n${'─'.repeat(40)}`);
    this.logger.warn(
      `⚠️  已达到最大迭代次数 (${this.config.maxIterations})，生成最终计划...`
    );
    this.logger.warn(`${'─'.repeat(40)}\n`);

    const finalResult = await this.basePlanner.plan(userRequest);

    // Add metadata to indicate mock usage
    if (
      finalResult.success &&
      finalResult.plan &&
      allGeneratedMocks.length > 0
    ) {
      finalResult.plan.metadata = {
        usesMocks: true,
        mockFunctions: allGeneratedMocks,
      };
    }

    return finalResult;
  }
}
