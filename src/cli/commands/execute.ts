import chalk from 'chalk';
import inquirer from 'inquirer';
import container from '../../container/cli-container.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Executor } from '../../executor/index.js';
import { ExecutorImpl } from '../../executor/implementations/ExecutorImpl.js';
import { ConditionalExecutor } from '../../executor/implementations/ConditionalExecutor.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { StepType } from '../../planner/types.js';
import { loadFunctions } from '../utils.js';

interface ExecuteOptions {
  functions: string;
  yes: boolean;
}

export async function executeCommand(
  planId: string,
  options: ExecuteOptions
): Promise<void> {
  try {
    // 加载计划
    const storage = container.get<Storage>(Storage);
    const plan = await storage.loadPlan(planId);

    if (!plan) {
      console.log(chalk.red(`❌ 找不到计划: ${planId}`));
      console.log(chalk.gray('使用 "npx fn-orchestrator list plans" 查看所有计划'));
      return;
    }

    // 加载函数（先加载，以便显示已加载的函数列表）
    const functionProvider = container.get<FunctionProvider>(FunctionProvider);
    await loadFunctions(functionProvider, options.functions);

    // 加载 Plan 的 mock 函数（新架构：从 plan-specific 目录加载）
    if (plan.metadata?.usesMocks) {
      try {
        const planMocks = await storage.loadPlanMocks(planId);
        planMocks.forEach((fn) => {
          // Type assertion: the loaded modules conform to FunctionDefinition at runtime
          functionProvider.register?.(fn as any);
        });
        console.log(
          chalk.gray(`已加载 ${planMocks.length} 个 plan-specific mock 函数`)
        );
      } catch (error) {
        console.log(
          chalk.yellow(
            `⚠️ 无法加载 plan-specific mocks: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    }

    // 打印所有加载的函数
    const allFunctions = await functionProvider.list();
    console.log(chalk.blue('📦 已加载的函数:'));
    console.log(chalk.gray(`总共 ${allFunctions.length} 个函数`));
    console.log();

    // 区分 mock 函数和普通函数
    const mockFunctions = plan.metadata?.mockFunctions || [];
    const mockFunctionNames = mockFunctions.map((m) => m.name);
    const normalFunctions = allFunctions.filter(
      (f) => !mockFunctionNames.includes(f.name)
    );
    const loadedMocks = allFunctions.filter((f) =>
      mockFunctionNames.includes(f.name)
    );

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
          (mockRef) => !allFunctions.some((f) => f.name === mockRef.name)
        );

        if (missingMocks.length > 0) {
          console.log();
          console.log(chalk.red('⚠️ 计划需要但未加载的 mock 函数:'));
          missingMocks.forEach((mockRef) => {
            console.log(chalk.gray(`  • ${mockRef.name} (v${mockRef.version})`));
          });
          console.log();
          console.log(chalk.yellow('提示: 请重新运行 plan 命令生成这些 mock 函数'));
        }
      }
      return;
    }

    // 从容器获取 Planner 用于显示计划
    const planner = container.get<Planner>(Planner);

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

    // 根据计划内容选择执行器
    const hasConditionSteps = plan.steps.some(step => step.type === StepType.CONDITION);
    const executor: Executor = hasConditionSteps
      ? new ConditionalExecutor(functionProvider)
      : new ExecutorImpl(functionProvider);

    if (hasConditionSteps) {
      console.log(chalk.gray('ℹ️  检测到条件分支步骤，使用条件执行器'));
    }

    const result = await executor.execute(plan);

    // 保存执行结果
    const execId = await storage.saveExecution(result);

    // 显示结果
    console.log(executor.formatResultForDisplay(result));
    console.log();

    if (result.success) {
      console.log(chalk.green('✅ 执行成功!'));
      console.log(chalk.gray(`执行记录 ID: ${execId}`));
      process.exit(0);
    } else {
      console.log(chalk.red('❌ 执行失败'));
      console.log(chalk.gray(`执行记录 ID: ${execId}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`)
    );
    process.exit(1);
  }
}
