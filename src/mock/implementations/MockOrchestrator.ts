import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { IMockCodeGenerator } from '../interfaces/IMockCodeGenerator.js';
import type { IMockFileWriter } from '../interfaces/IMockFileWriter.js';
import type { IMockFunctionLoader } from '../interfaces/IMockFunctionLoader.js';
import type { IMockMetadataProvider } from '../interfaces/IMockMetadataProvider.js';
import type { IMockCodeValidator } from '../interfaces/IMockCodeValidator.js';
import type { MissingFunction } from '../../planner/types.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { MockGenerationResult, MockMetadata } from '../types.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';
import * as fs from 'fs/promises';

/**
 * Orchestrates the mock function generation workflow
 * Follows Facade pattern: Coordinates multiple services
 * Follows SRP: Only responsible for workflow coordination
 */
export class MockOrchestrator implements IMockOrchestrator {
  private logger: ILogger;

  constructor(
    private codeGenerator: IMockCodeGenerator,
    private fileWriter: IMockFileWriter,
    private functionLoader: IMockFunctionLoader,
    private metadataProvider: IMockMetadataProvider,
    private registry: FunctionRegistry,
    private validator?: IMockCodeValidator,
    logger?: ILogger
  ) {
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * Generate and register mock functions for missing functions
   */
  async generateAndRegisterMocks(
    missingFunctions: MissingFunction[]
  ): Promise<MockGenerationResult> {
    const results: MockMetadata[] = [];
    const errors: Array<{ functionName: string; error: string }> = [];

    for (const missing of missingFunctions) {
      let filePath: string | null = null;

      try {
        this.logger.info(`  生成 ${missing.name}...`);

        // 1. Generate code
        const code = await this.codeGenerator.generate({
          name: missing.name,
          description: missing.description,
          parameters: missing.suggestedParameters,
          returns: missing.suggestedReturns,
        });

        // 2. Write to file (with timestamp to avoid conflicts)
        // Generate .js file directly so it can be dynamically imported
        const fileName = `${missing.name}-${Date.now()}.js`;
        filePath = await this.fileWriter.write(code, fileName);
        this.logger.info(`    ✓ 文件已保存: ${filePath}`);

        // 3. Validate code (optional, if validator is provided)
        if (this.validator) {
          const validationResult = await this.validator.validateCode(filePath);
          if (!validationResult.success) {
            throw new Error(
              `Code validation failed: ${validationResult.error}\n${validationResult.details || ''}`
            );
          }
        }

        // 4. Load function definitions from file
        const functions = await this.functionLoader.load(filePath);
        this.logger.info(`    ✓ 加载了 ${functions.length} 个函数定义`);

        // 5. Test each function (optional, if validator is provided)
        if (this.validator) {
          for (const fn of functions) {
            const testResult = await this.validator.testFunction(fn);
            if (!testResult.success) {
              throw new Error(
                `Function test failed for "${fn.name}": ${testResult.error}`
              );
            }
          }
        }

        // 6. Register functions to registry
        this.functionLoader.register(this.registry, functions);
        this.logger.info(`    ✓ 已注册到 registry: ${functions.map(f => f.name).join(', ')}`);

        // 7. Mark as mock and store metadata
        const metadata: MockMetadata = {
          functionName: missing.name,
          filePath,
          generatedAt: new Date().toISOString(),
          isMock: true,
        };
        this.metadataProvider.markAsMock(missing.name, metadata);

        results.push(metadata);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`    ✗ 生成失败: ${missing.name}`);
        this.logger.warn(`       错误: ${errorMsg}`);

        // Clean up: Delete the invalid file if it was created
        if (filePath) {
          try {
            await fs.unlink(filePath);
            this.logger.info(`    🗑️  已删除无效文件: ${filePath}`);
          } catch (deleteError) {
            // Ignore deletion errors (file might not exist)
            this.logger.warn(`    ⚠️  无法删除文件: ${filePath}`);
          }
        }

        errors.push({
          functionName: missing.name,
          error: errorMsg,
        });
      }
    }

    // 汇总统计
    const total = missingFunctions.length;
    const succeeded = results.length;
    const failed = errors.length;

    if (succeeded > 0 && failed > 0) {
      this.logger.info(
        `\n📊 生成结果: 成功 ${succeeded}/${total} 个，失败 ${failed} 个`
      );
      if (failed > 0) {
        this.logger.warn(`\n❌ 失败的函数:`);
        errors.forEach((err) => {
          this.logger.warn(`   • ${err.functionName}: ${err.error}`);
        });
      }
    }

    return {
      success: results.length > 0, // 只要有一个成功就算成功
      generatedFunctions: results,
      ...(errors.length > 0 && { errors }),
    };
  }
}
