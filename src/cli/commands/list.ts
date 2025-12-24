import chalk from 'chalk';
import { FunctionRegistry } from '../../registry/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions } from '../utils.js';
import { ConfigManager } from '../../config/index.js';

interface ListFunctionsOptions {
  functions: string;
}

export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      const registry = new FunctionRegistry();
      await loadFunctions(registry, options.functions);

      const functions = registry.getAll();

      if (functions.length === 0) {
        console.log(chalk.yellow('没有找到已注册的函数'));
        console.log(chalk.gray(`请检查函数定义文件: ${options.functions}`));
        process.exit(1);
      }

      console.log(chalk.blue(`📚 已注册的函数 (${functions.length} 个):`));
      console.log();
      console.log(registry.getAllDescriptions());
      process.exit(0);
    } catch (error) {
      console.error(
        chalk.red(
          `❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`
        )
      );
      process.exit(1);
    }
  },

  async plans(): Promise<void> {
    try {
      // Get centralized configuration (initialized by CLI hook)
      const config = ConfigManager.get();
      const storage = new Storage(config.storage.dataDir);
      const plans = await storage.listPlans();

      if (plans.length === 0) {
        console.log(chalk.yellow('没有保存的执行计划'));
        process.exit(0);
      }

      console.log(chalk.blue(`📋 执行计划列表 (${plans.length} 个):`));
      console.log();

      for (const plan of plans) {
        const statusIcon = plan.status === 'executable' ? '✅' : '⚠️';
        console.log(
          `${statusIcon} ${chalk.cyan(plan.id)} - ${plan.userRequest}`
        );
        console.log(
          chalk.gray(`   创建时间: ${plan.createdAt} | 步骤数: ${plan.steps.length}`)
        );
      }
      process.exit(0);
    } catch (error) {
      console.error(
        chalk.red(
          `❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`
        )
      );
      process.exit(1);
    }
  },

  async showPlan(planId: string): Promise<void> {
    try {
      // Get centralized configuration (initialized by CLI hook)
      const config = ConfigManager.get();
      const storage = new Storage(config.storage.dataDir);
      const plan = await storage.loadPlan(planId);

      if (!plan) {
        console.log(chalk.red(`❌ 找不到计划: ${planId}`));
        process.exit(1);
      }

      // 创建临时 Planner 用于格式化显示
      const registry = new FunctionRegistry();
      // 创建一个 dummy LLM client（不会被调用，仅用于格式化）
      const dummyLLMClient = {
        async generatePlan() { return ''; }
      };
      const planner = new Planner(registry, dummyLLMClient);

      console.log(planner.formatPlanForDisplay(plan));
      process.exit(0);
    } catch (error) {
      console.error(
        chalk.red(
          `❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`
        )
      );
      process.exit(1);
    }
  },
};
