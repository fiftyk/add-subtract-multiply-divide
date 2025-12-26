import chalk from 'chalk';
import container from '../../container.js';
import { FunctionRegistry } from '../../registry/interfaces/FunctionRegistry.js';
import { ToolProvider } from '../../tools/interfaces/ToolProvider.js';
import { RemoteToolProvider } from '../../mcp/RemoteToolProvider.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions } from '../utils.js';

interface ListFunctionsOptions {
  functions: string;
}

export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      // 加载内置函数
      const registry = container.get<FunctionRegistry>(FunctionRegistry);
      await loadFunctions(registry, options.functions);
      const allFunctions = registry.getAll();

      // 获取本地工具
      const toolProvider = container.get<ToolProvider>(ToolProvider);
      const localTools = await toolProvider.searchTools();

      // 获取远程 MCP 工具（如果有 MCP 配置）
      const remoteToolProvider = container.get<RemoteToolProvider>(RemoteToolProvider);
      const remoteTools = await remoteToolProvider.searchTools();

      if (allFunctions.length === 0 && remoteTools.length === 0) {
        console.log(chalk.yellow('没有找到已注册的函数或工具'));
        console.log(chalk.gray(`请检查函数定义文件: ${options.functions}`));
        process.exit(1);
      }

      // 显示本地函数列表
      if (allFunctions.length > 0) {
        console.log(chalk.blue(`📚 本地函数 (${allFunctions.length} 个):`));
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
      }

      // 显示远程工具列表
      if (remoteTools.length > 0) {
        console.log(chalk.blue(`🔗 远程 MCP 工具 (${remoteTools.length} 个):`));
        console.log();

        for (const tool of remoteTools) {
          console.log(chalk.cyan(`- ${tool.name}`));
          console.log(chalk.gray(`  描述: ${tool.description}`));
          console.log(chalk.gray('  参数:'));
          if (tool.parameters.length === 0) {
            console.log(chalk.gray('    (无参数)'));
          } else {
            for (const param of tool.parameters) {
              console.log(chalk.gray(`    - ${param.name} (${param.type}): ${param.description}`));
            }
          }
          console.log(chalk.gray(`  返回类型: ${tool.returns.type}`));
          if (tool.returns.description) {
            console.log(chalk.gray(`  返回描述: ${tool.returns.description}`));
          }
          console.log();
        }
      }

      // 汇总统计
      console.log(chalk.blue(`📊 总计: ${allFunctions.length} 个本地函数, ${remoteTools.length} 个远程工具`));

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
