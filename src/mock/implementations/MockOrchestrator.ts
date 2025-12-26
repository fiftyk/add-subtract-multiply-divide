import type { IMockOrchestrator } from '../interfaces/IMockOrchestrator.js';
import type { IMockCodeGenerator } from '../interfaces/IMockCodeGenerator.js';
import type { IMockFileWriter } from '../interfaces/IMockFileWriter.js';
import type { IMockFunctionLoader } from '../interfaces/IMockFunctionLoader.js';
import type { IMockMetadataProvider } from '../interfaces/IMockMetadataProvider.js';
import type { IMockCodeValidator } from '../interfaces/IMockCodeValidator.js';
import type { MissingFunction, MockFunctionReference } from '../../planner/types.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { MockGenerationResult, MockMetadata } from '../types.js';
import type { ILogger } from '../../logger/index.js';
import { LoggerFactory } from '../../logger/index.js';
import { Storage } from '../../storage/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Orchestrates the mock function generation workflow
 * Follows Facade pattern: Coordinates multiple services
 * Follows SRP: Only responsible for workflow coordination
 */
export class MockOrchestrator implements IMockOrchestrator {
  private logger: ILogger;

  constructor(
    private planId: string, // NEW: Track which plan we're generating for
    private storage: Storage, // NEW: Storage for saving mocks to plan directory
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
   * Determine the next version number for a mock function
   * Checks existing mock files in the plan's mocks directory
   */
  private async getNextVersion(functionName: string): Promise<number> {
    const mocksDir = this.storage.getPlanMocksDir(this.planId);

    try {
      // Check if mocks directory exists
      await fs.access(mocksDir);
      const files = await fs.readdir(mocksDir);

      // Find existing versions of this function
      const pattern = new RegExp(`^${functionName}-v(\\d+)\\.js$`);
      const versions: number[] = [];

      for (const file of files) {
        const match = file.match(pattern);
        if (match) {
          versions.push(parseInt(match[1], 10));
        }
      }

      // Return next version (max + 1, or 1 if no versions exist)
      return versions.length > 0 ? Math.max(...versions) + 1 : 1;
    } catch {
      // Directory doesn't exist or can't be read, start at version 1
      return 1;
    }
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
      let version: number | null = null;

      try {
        // Determine version for this mock
        version = await this.getNextVersion(missing.name);
        this.logger.info(
          `  📝 生成 ${missing.name} (v${version})${version > 1 ? ' [升级]' : ''}...`
        );

        // 1. Generate code
        const code = await this.codeGenerator.generate({
          name: missing.name,
          description: missing.description,
          parameters: missing.suggestedParameters,
          returns: missing.suggestedReturns,
        });

        // 2. Save to plan's mocks directory using Storage
        const relativePath = await this.storage.savePlanMock(
          this.planId,
          missing.name,
          version,
          code
        );

        // Build absolute file path for loading
        const mocksDir = this.storage.getPlanMocksDir(this.planId);
        filePath = path.join(mocksDir, `${missing.name}-v${version}.js`);
        this.logger.info(`    📝 文件已保存: ${relativePath}`);

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
        this.logger.info(`    📝 加载了 ${functions.length} 个函数定义`);

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
        this.logger.info(
          `    📝 已注册到 registry: ${functions.map((f) => f.name).join(', ')}`
        );

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
        this.logger.warn(`    ⚠️  生成失败: ${missing.name}`);
        this.logger.warn(`          错误: ${errorMsg}`);

        // Clean up: Delete the invalid file if it was created
        if (filePath) {
          try {
            await fs.unlink(filePath);
            this.logger.info(`    📝 已删除无效文件: ${filePath}`);
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
        `\n📝 生成结果: 成功 ${succeeded}/${total} 个，失败 ${failed} 个`
      );
      if (failed > 0) {
        this.logger.warn(`\n⚠️  失败的函数:`);
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
