import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { FunctionRegistry } from '../../registry/index.js';
import { Executor } from '../../executor/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions, loadFunctionsFromDirectory } from '../utils.js';
import { loadConfig } from '../../config/index.js';

interface ExecuteOptions {
  functions: string;
  yes: boolean;
}

export async function executeCommand(
  planId: string,
  options: ExecuteOptions
): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // 加载计划
    const storage = new Storage(config.storage.dataDir);
    const plan = await storage.loadPlan(planId);

    if (!plan) {
      console.log(chalk.red(`❌ 找不到计划: ${planId}`));
      console.log(chalk.gray('使用 "npx fn-orchestrator list plans" 查看所有计划'));
      return;
    }

    // 加载函数（先加载，以便显示已加载的函数列表）
    const registry = new FunctionRegistry();
    await loadFunctions(registry, options.functions);

    // 同时加载 generated 目录下的 mock 函数
    await loadFunctionsFromDirectory(
      registry,
      config.mock.outputDir
    );

    // 打印所有加载的函数
    const allFunctions = registry.getAll();
    console.log(chalk.blue('📦 已加载的函数:'));
    console.log(chalk.gray(`总共 ${allFunctions.length} 个函数`));
    console.log();

    // 区分 mock 函数和普通函数
    const mockFunctions = plan.metadata?.mockFunctions || [];
    const normalFunctions = allFunctions.filter(f => !mockFunctions.includes(f.name));
    const loadedMocks = allFunctions.filter(f => mockFunctions.includes(f.name));

    if (normalFunctions.length > 0) {
      console.log(chalk.cyan('普通函数:'));
      normalFunctions.forEach(f => {
        console.log(chalk.gray(`  • ${f.name}`));
      });
      console.log();
    }

    if (loadedMocks.length > 0) {
      console.log(chalk.yellow('Mock 函数:'));
      loadedMocks.forEach(f => {
        console.log(chalk.gray(`  • ${f.name} (mock)`));
      });
      console.log();
    }

    // 检查计划状态
    if (plan.status !== 'executable') {
      console.log(chalk.yellow('⚠️ 该计划不可执行'));
      if (plan.missingFunctions && plan.missingFunctions.length > 0) {
        console.log(chalk.gray('缺少以下函数:'));
        for (const fn of plan.missingFunctions) {
          console.log(chalk.gray(`  - ${fn.name}: ${fn.description}`));
        }
      }

      // 检查计划需要的 mock 函数是否都已加载
      if (mockFunctions.length > 0) {
        const missingMocks = mockFunctions.filter(
          name => !allFunctions.some(f => f.name === name)
        );

        if (missingMocks.length > 0) {
          console.log();
          console.log(chalk.red('⚠️ 计划需要但未加载的 mock 函数:'));
          missingMocks.forEach(name => {
            console.log(chalk.gray(`  • ${name}`));
          });
          console.log();
          console.log(chalk.yellow('提示: 请重新运行 plan 命令生成这些 mock 函数'));
        }
      }
      return;
    }

    // 创建临时 Planner 用于显示计划
    // 创建一个 dummy LLM client（不会被调用，仅用于格式化）
    const dummyLLMClient = {
      async generatePlan() { return ''; }
    };
    const planner = new Planner(registry, dummyLLMClient);

    // 显示计划
    console.log(chalk.blue('📋 执行计划:'));
    console.log();
    console.log(planner.formatPlanForDisplay(plan));
    console.log();

    // 确认执行
    if (!options.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确认执行此计划?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('已取消执行'));
        return;
      }
    }

    console.log();
    console.log(chalk.blue('🚀 开始执行...'));
    console.log();

    // 执行计划
    const executor = new Executor(registry, { stepTimeout: config.executor.stepTimeout });
    const result = await executor.execute(plan);

    // 保存执行结果
    const execId = await storage.saveExecution(result);

    // 显示结果
    console.log(executor.formatResultForDisplay(result));
    console.log();

    if (result.success) {
      console.log(chalk.green('✅ 执行成功!'));
    } else {
      console.log(chalk.red('❌ 执行失败'));
    }

    console.log(chalk.gray(`执行记录 ID: ${execId}`));
  } catch (error) {
    console.error(
      chalk.red(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`)
    );
    process.exit(1);
  }
}
