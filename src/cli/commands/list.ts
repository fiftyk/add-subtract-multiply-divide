import chalk from 'chalk';
import container from '../../container.js';
import { FunctionRegistry } from '../../registry/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions } from '../utils.js';

interface ListFunctionsOptions {
  functions: string;
}

export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      const registry = container.get(FunctionRegistry);

      // 加载内置函数
      await loadFunctions(registry, options.functions);
      const allFunctions = registry.getAll();

      if (allFunctions.length === 0) {
        console.log(chalk.yellow('没有找到已注册的函数'));
        console.log(chalk.gray(`请检查函数定义文件: ${options.functions}`));
        process.exit(1);
      }

      // 显示函数列表
      console.log(chalk.blue(`📚 已注册的函数 (${allFunctions.length} 个):`));
      console.log();

      for (const func of allFunctions) {
        console.log(chalk.white(`- ${func.name}: ${func.description}`));
        if (func.scenario) {
          console.log(chalk.gray(`  使用场景: ${func.scenario}`));
        }
        console.log(chalk.gray('  参数:'));
        for (const param of func.parameters) {
          console.log(chalk.gray(`    - ${param.name} (${param.type}): ${param.description}`));
        }
        console.log(chalk.gray(`  返回值: ${func.returns.type} - ${func.returns.description}`));
        console.log();
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

  async plans(): Promise<void> {
    try {
      const storage = container.get<Storage>(Storage);
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
      const storage = container.get<Storage>(Storage);
      const plan = await storage.loadPlan(planId);

      if (!plan) {
        console.log(chalk.red(`❌ 找不到计划: ${planId}`));
        process.exit(1);
      }

      // 从容器获取 Planner 用于格式化显示
      const planner = container.get<Planner>(Planner);

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
