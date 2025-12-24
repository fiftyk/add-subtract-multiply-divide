import chalk from 'chalk';
import { FunctionRegistry } from '../../registry/index.js';
import { Planner, AnthropicPlannerLLMClient } from '../../planner/index.js';
import { Storage } from '../../storage/index.js';
import { loadFunctions, loadFunctionsFromDirectory } from '../utils.js';
import {
  PlannerWithMockSupport,
  MockServiceFactory,
} from '../../mock/index.js';
import { ConfigManager } from '../../config/index.js';
import { LoggerFactory } from '../../logger/index.js';

interface PlanOptions {
  functions: string;
}

export async function planCommand(
  request: string,
  options: PlanOptions
): Promise<void> {
  try {
    console.log(chalk.blue('📝 正在分析需求...'));
    console.log(chalk.gray(`用户需求: ${request}`));
    console.log();

    // Get centralized configuration (initialized by CLI hook)
    const config = ConfigManager.get();

    // 加载内置函数
    const registry = new FunctionRegistry();
    await loadFunctions(registry, options.functions);

    // 加载已生成的 mock 函数
    await loadFunctionsFromDirectory(
      registry,
      config.mock.outputDir
    );

    // 检查是否有可用函数
    const allFunctions = registry.getAll();
    if (allFunctions.length === 0) {
      console.log(chalk.yellow('⚠️ 没有找到已注册的函数'));
      console.log(
        chalk.gray(`请确保函数定义文件存在: ${options.functions}`)
      );
      return;
    }

    // 统计内置函数和 mock 函数
    const builtinFunctionNames = ['add', 'subtract', 'multiply', 'divide'];
    const builtinFunctions = allFunctions.filter(f => builtinFunctionNames.includes(f.name));
    const mockFunctions = allFunctions.filter(f => !builtinFunctionNames.includes(f.name));

    console.log(
      chalk.gray(`已加载 ${allFunctions.length} 个函数: ${builtinFunctions.map((f) => f.name).join(', ')}`)
    );
    if (mockFunctions.length > 0) {
      console.log(
        chalk.yellow(`  + ${mockFunctions.length} 个 mock 函数: ${mockFunctions.map((f) => f.name).join(', ')}`)
      );
    }
    console.log();

    // 创建 logger (支持 LOG_LEVEL 环境变量)
    const logger = LoggerFactory.createFromEnv();

    // 创建 LLM 客户端
    const llmClient = new AnthropicPlannerLLMClient({
      apiKey: config.api.apiKey,
      baseURL: config.api.baseURL,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
      logger,
    });

    // 创建基础规划器
    const basePlanner = new Planner(registry, llmClient);

    // 根据配置决定是否启用 mock 支持
    let planner: Planner | PlannerWithMockSupport;

    if (config.mock.autoGenerate) {
      // 启用 mock 自动生成
      logger.debug('Mock 自动生成已启用', {
        maxIterations: config.mock.maxIterations,
        outputDir: config.mock.outputDir,
      });

      // 创建 mock 服务编排器
      const mockOrchestrator = MockServiceFactory.create({
        apiKey: config.api.apiKey,
        baseURL: config.api.baseURL,
        outputDir: config.mock.outputDir,
        registry,
        logger,
      });

      // 使用装饰器包装规划器，添加 mock 支持（OCP - 不修改原有 Planner）
      planner = new PlannerWithMockSupport(
        basePlanner,
        mockOrchestrator,
        registry,
        { maxIterations: config.mock.maxIterations },
        logger
      );
    } else {
      // 直接使用基础规划器，不启用 mock 生成
      logger.debug('Mock 自动生成已禁用');
      planner = basePlanner;
    }

    const result = await planner.plan(request);

    if (!result.success || !result.plan) {
      console.log(chalk.red(`❌ 规划失败: ${result.error}`));
      return;
    }

    // 保存计划
    const storage = new Storage(config.storage.dataDir);
    await storage.savePlan(result.plan);

    // 显示计划
    console.log(chalk.green('✅ 计划生成成功！'));
    console.log();
    console.log(basePlanner.formatPlanForDisplay(result.plan));
    console.log();

    // 显示 mock 警告
    if (result.plan.metadata?.usesMocks) {
      console.log(chalk.yellow('⚠️  此计划使用了 MOCK 数据，结果仅供测试'));
      console.log(
        chalk.gray(
          `📁 Mock functions: ${result.plan.metadata.mockFunctions?.join(', ')}`
        )
      );
      console.log(
        chalk.cyan(
          '💡 提示: 编辑 functions/generated/ 中的文件来实现真实逻辑'
        )
      );
      console.log();
    }

    if (result.plan.status === 'executable') {
      console.log(
        chalk.cyan(
          `执行命令: npx fn-orchestrator execute ${result.plan.id}`
        )
      );
      process.exit(0);
    } else {
      console.log(
        chalk.yellow(
          '⚠️ 计划不完整，请先实现缺失的函数'
        )
      );

      // 如果 mock 生成被禁用，提供友好提示
      if (!config.mock.autoGenerate && result.plan?.missingFunctions?.length) {
        console.log();
        console.log(
          chalk.cyan(`💡 提示: 缺少 ${result.plan.missingFunctions.length} 个函数`)
        );
        console.log(
          chalk.gray('   使用 --auto-mock 标志可以自动生成缺失函数的 mock 实现')
        );
        console.log(
          chalk.gray('   或在环境变量中设置 AUTO_GENERATE_MOCK=true')
        );
        console.log();
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`)
    );
    process.exit(1);
  }
}
