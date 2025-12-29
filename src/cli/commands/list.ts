import chalk from 'chalk';
import container from '../../container.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions } from '../utils.js';

interface ListFunctionsOptions {
  functions: string;
}

export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      // 使用统一的 FunctionProvider（CompositeFunctionProvider）
      // 它会自动组合本地和远程函数
      const functionProvider = container.get<FunctionProvider>(FunctionProvider);

      // 加载内置函数
      await loadFunctions(functionProvider, options.functions);

      const allFunctions = await functionProvider.list();

      if (allFunctions.length === 0) {
        console.log(chalk.yellow('没有找到已注册的函数'));
        console.log(chalk.gray(`请检查函数定义文件: ${options.functions}`));
        process.exit(1);
      }

      // 按来源分组显示函数
      const localFunctions = allFunctions.filter(f => f.source === 'local');
      const remoteFunctions = allFunctions.filter(f => f.source !== 'local');

      // 显示本地函数列表
      if (localFunctions.length > 0) {
        console.log(chalk.blue(`📚 本地函数 (${localFunctions.length} 个):`));
        console.log();

        for (const func of localFunctions) {
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
      }

      // 显示远程函数列表
      if (remoteFunctions.length > 0) {
        console.log(chalk.blue(`🔗 远程函数 (${remoteFunctions.length} 个):`));
        console.log();

        for (const func of remoteFunctions) {
          console.log(chalk.cyan(`- ${func.name}`));
          console.log(chalk.gray(`  来源: ${func.source}`));
          console.log(chalk.gray(`  描述: ${func.description}`));
          console.log(chalk.gray('  参数:'));
          if (func.parameters.length === 0) {
            console.log(chalk.gray('    (无参数)'));
          } else {
            for (const param of func.parameters) {
              console.log(chalk.gray(`    - ${param.name} (${param.type}): ${param.description}`));
            }
          }
          console.log(chalk.gray(`  返回类型: ${func.returns.type}`));
          if (func.returns.description) {
            console.log(chalk.gray(`  返回描述: ${func.returns.description}`));
          }
          console.log();
        }
      }

      // 汇总统计
      console.log(chalk.blue(`📊 总计: ${localFunctions.length} 个本地函数, ${remoteFunctions.length} 个远程函数`));

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
