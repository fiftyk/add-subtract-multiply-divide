import chalk from 'chalk';
import { FunctionRegistry } from '../../registry/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { loadFunctions, loadFunctionsFromDirectory } from '../utils.js';
import { ConfigManager } from '../../config/index.js';

interface ListFunctionsOptions {
  functions: string;
}

export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      // Get centralized configuration
      const config = ConfigManager.get();

      const registry = new FunctionRegistry();

      // 加载内置函数
      await loadFunctions(registry, options.functions);
      const builtinCount = registry.getAll().length;

      // 加载 mock 函数
      await loadFunctionsFromDirectory(registry, config.mock.outputDir);
      const allFunctions = registry.getAll();
      const mockCount = allFunctions.length - builtinCount;

      if (allFunctions.length === 0) {
        console.log(chalk.yellow('没有找到已注册的函数'));
        console.log(chalk.gray(`请检查函数定义文件: ${options.functions}`));
        process.exit(1);
      }

      // 统计信息
      console.log(chalk.blue(`📚 已注册的函数 (${allFunctions.length} 个):`));
      if (builtinCount > 0) {
        console.log(chalk.gray(`  - 内置函数: ${builtinCount} 个`));
      }
      if (mockCount > 0) {
        console.log(chalk.yellow(`  - Mock 函数: ${mockCount} 个 (${config.mock.outputDir})`));
      }
      console.log();

      // 区分显示内置函数和 mock 函数
      const builtinFunctionNames = ['add', 'subtract', 'multiply', 'divide'];
      const builtinFunctions = allFunctions.filter(f => builtinFunctionNames.includes(f.name));
      const mockFunctions = allFunctions.filter(f => !builtinFunctionNames.includes(f.name));

      // 显示内置函数
      if (builtinFunctions.length > 0) {
        console.log(chalk.cyan('═══ 内置函数 ═══'));
        console.log();
        for (const func of builtinFunctions) {
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

      // 显示 mock 函数
      if (mockFunctions.length > 0) {
        console.log(chalk.yellow('═══ Mock 函数 ═══'));
        console.log();
        for (const func of mockFunctions) {
          console.log(chalk.yellow(`- ${func.name}: ${func.description}`));
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
        console.log(chalk.gray(`💡 提示: Mock 函数位于 ${config.mock.outputDir}/ 目录`));
        console.log(chalk.gray('   你可以编辑这些文件来实现真实逻辑'));
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
