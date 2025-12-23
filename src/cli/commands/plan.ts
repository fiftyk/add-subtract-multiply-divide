import chalk from 'chalk';
import path from 'path';
import { FunctionRegistry } from '../../registry/index.js';
import { Planner, AnthropicPlannerLLMClient } from '../../planner/index.js';
import { Storage } from '../../storage/index.js';
import { loadFunctions } from '../utils.js';
import {
  PlannerWithMockSupport,
  MockServiceFactory,
} from '../../mock/index.js';

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

    // 加载函数
    const registry = new FunctionRegistry();
    await loadFunctions(registry, options.functions);

    // 检查是否有可用函数
    const allFunctions = registry.getAll();
    if (allFunctions.length === 0) {
      console.log(chalk.yellow('⚠️ 没有找到已注册的函数'));
      console.log(
        chalk.gray(`请确保函数定义文件存在: ${options.functions}`)
      );
      return;
    }

    console.log(
      chalk.gray(`已加载 ${allFunctions.length} 个函数: ${allFunctions.map((f) => f.name).join(', ')}`)
    );
    console.log();

    // 获取 API Key - 支持 ANTHROPIC_API_KEY 和 ANTHROPIC_AUTH_TOKEN
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
    if (!apiKey) {
      console.log(chalk.red('❌ 请设置 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN 环境变量'));
      process.exit(1);
    }

    // 创建 LLM 客户端
    const llmClient = new AnthropicPlannerLLMClient({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    // 创建基础规划器
    const basePlanner = new Planner(registry, llmClient);

    // 创建 mock 服务编排器
    const mockOrchestrator = MockServiceFactory.create({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL,
      outputDir: path.join(process.cwd(), 'functions/generated'),
      registry,
    });

    // 使用装饰器包装规划器，添加 mock 支持（OCP - 不修改原有 Planner）
    const planner = new PlannerWithMockSupport(
      basePlanner,
      mockOrchestrator,
      registry
    );

    const result = await planner.plan(request);

    if (!result.success || !result.plan) {
      console.log(chalk.red(`❌ 规划失败: ${result.error}`));
      return;
    }

    // 保存计划
    const storage = new Storage();
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
    } else {
      console.log(
        chalk.yellow(
          '⚠️ 计划不完整，请先实现缺失的函数'
        )
      );
    }
  } catch (error) {
    console.error(
      chalk.red(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`)
    );
    process.exit(1);
  }
}
