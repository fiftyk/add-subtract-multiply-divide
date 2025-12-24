import type { Planner } from '../../planner/planner.js';
import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { PlanResult, MockFunctionReference } from '../../planner/types.js';
import type { ILogger } from '../../logger/index.js';
import type { MockGenerationConfig } from '../types.js';
import { LoggerFactory } from '../../logger/index.js';

/**
 * Decorator for Planner that adds automatic mock generation support
 * Follows Decorator Pattern: Extends behavior without modifying the original class
 * Follows OCP: Open for extension (via decoration), closed for modification
 */
export class PlannerWithMockSupport {
  private logger: ILogger;
  private config: MockGenerationConfig;

  constructor(
    private basePlanner: Planner,
    private mockOrchestrator: IMockOrchestrator,
    private registry: FunctionRegistry,
    config: MockGenerationConfig,
    logger?: ILogger
  ) {
    this.logger = logger ?? LoggerFactory.create();
    this.config = config;
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
        this.logger.info(`\n${'='.repeat(60)}`);
        this.logger.info(`🔄 第 ${iteration} 轮迭代生成...`);
        this.logger.info(`${'='.repeat(60)}`);
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
        this.logger.info('\n📋 缺少的函数:');
        result.plan.missingFunctions.forEach((fn, index) => {
          this.logger.info(`  ${index + 1}. ${fn.name}`);
          if (fn.description) {
            this.logger.info(`     描述: ${fn.description}`);
          }
        });

        // Now generate mocks
        this.logger.info('\n🔧 正在生成 mock 实现...');

        const mockResult =
          await this.mockOrchestrator.generateAndRegisterMocks(
            result.plan.missingFunctions
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
            `\n📊 当前 registry 中共有 ${this.registry.getAll().length} 个函数`
          );

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
    this.logger.warn(`\n${'='.repeat(60)}`);
    this.logger.warn(
      `⚠️  已达到最大迭代次数 (${this.config.maxIterations})，生成最终计划...`
    );
    this.logger.warn(`${'='.repeat(60)}\n`);

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
