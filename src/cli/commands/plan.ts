import chalk from 'chalk';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import container, { MockServiceFactory } from '../../container.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Planner } from '../../planner/index.js';
import { Storage } from '../../storage/index.js';
import { Executor } from '../../executor/index.js';
import { loadFunctions } from '../utils.js';
import { PlannerWithMockSupport } from '../../mock/index.js';
import { ConfigManager } from '../../config/index.js';
import { LoggerFactory } from '../../logger/index.js';
import {
  InteractivePlanService,
  PlanRefinementLLMClient,
  SessionStorage,
} from '../../services/index.js';
import type { ExecutionPlan } from '../../planner/types.js';
import { isFunctionCallStep } from '../../planner/type-guards.js';
import type { AppConfig } from '../../config/types.js';

interface PlanOptions {
  functions: string;
  interactive?: boolean;
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

    // 从容器获取函数提供者
    const functionProvider = container.get<FunctionProvider>(FunctionProvider);
    await loadFunctions(functionProvider, options.functions);

    // 检查是否有可用函数
    const allFunctions = await functionProvider.list();
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

    // 创建基础规划器（容器自动注入依赖）
    const basePlanner = container.get<Planner>(Planner);

    // 根据配置决定是否启用 mock 支持
    let planner: Planner | PlannerWithMockSupport;

    // 生成 planId（用于 mock 存储）
    const planId = `plan-${uuidv4().slice(0, 8)}`;

    // 创建 Storage 实例
    const storage = container.get<Storage>(Storage);

    if (config.mock.autoGenerate) {
      // 启用 mock 自动生成
      logger.info('✨ Mock 自动生成已启用', {
        maxIterations: config.mock.maxIterations,
      });

      // 从容器获取 MockServiceFactory，创建 mock 服务编排器
      const mockServiceFactory = container.get<MockServiceFactory>(MockServiceFactory);
      const mockOrchestrator = mockServiceFactory.createOrchestrator(planId);

      // 使用装饰器包装规划器，添加 mock 支持（OCP - 不修改原有 Planner）
      planner = new PlannerWithMockSupport(
        basePlanner,
        mockOrchestrator,
        functionProvider,
        { maxIterations: config.mock.maxIterations },
        logger
      );
    } else {
      // 直接使用基础规划器，不启用 mock 生成
      logger.info('ℹ️  Mock 自动生成已禁用');
      planner = basePlanner;
    }

    const result = await planner.plan(request);

    if (!result.success || !result.plan) {
      console.log(chalk.red(`❌ 规划失败: ${result.error}`));
      process.exit(1);
    }

    // Override the plan ID with our pre-generated one (for consistency with mock storage)
    result.plan.id = planId;

    // 保存计划
    await storage.savePlan(result.plan);

    // 显示计划
    console.log(chalk.cyan('✅ 计划生成成功！'));
    console.log();
    console.log(basePlanner.formatPlanForDisplay(result.plan));
    console.log();

    // 显示 mock 警告
    if (result.plan.metadata?.usesMocks) {
      console.log(chalk.yellow('⚠️  此计划使用了 MOCK 数据，结果仅供测试'));

      // 提取函数名列表
      const mockFunctionNames = result.plan.metadata.mockFunctions?.map((f: { name: string }) => f.name).join(', ') || '';
      console.log(
        chalk.gray(
          `📁 Mock functions: ${mockFunctionNames}`
        )
      );

      // 显示 mock 文件路径
      const mockDir = storage.getPlanMocksDir(result.plan.id);
      console.log(
        chalk.cyan(
          `💡 提示: 编辑 ${mockDir} 中的文件来实现真实逻辑`
        )
      );
      console.log();
    }

    if (result.plan.status === 'executable') {
      // 检查是否为交互模式
      if (options.interactive) {
        await interactivePlanFlow(result.plan, config, functionProvider, storage);
      } else {
        console.log(
          chalk.cyan(
            `执行命令: npx fn-orchestrator execute ${result.plan.id}`
          )
        );
        process.exit(0);
      }
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

/**
 * 交互式 Plan 流程（简化版）
 *
 * @param plan - 刚创建的计划
 * @param config - 配置对象
 * @param functionProvider - 函数提供者
 * @param storage - 存储实例
 */
async function interactivePlanFlow(
  plan: ExecutionPlan,
  config: AppConfig,
  functionProvider: FunctionProvider,
  storage: Storage
): Promise<void> {
  let currentPlan = plan;
  let currentPlanId = plan.id;

  // 处理用户中断（Ctrl+C）
  const handleInterrupt = () => {
    console.log();
    console.log(chalk.yellow('👋 用户中断，已退出'));
    process.exit(0);
  };
  process.on('SIGINT', handleInterrupt);

  // 初始化 Service（用于改进）
  const sessionStorage = container.get<SessionStorage>(SessionStorage);
  const planner = container.get<Planner>(Planner);
  const refinementLLMClient = container.get<PlanRefinementLLMClient>(PlanRefinementLLMClient);
  const service = new InteractivePlanService(
    planner,
    storage,
    sessionStorage,
    refinementLLMClient,
    functionProvider
  );

  let sessionId: string | undefined;

  try {
    while (true) {
      console.log();
      console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log();

      // 直接输入操作
      const { input } = await inquirer.prompt([{
        type: 'input',
        name: 'input',
        message: '请输入操作（改进指令 / "execute"(e) 执行 / "show"(s) 查看 / "quit"(q) 退出）：',
      }]);

      const command = input.trim().toLowerCase();

      // 执行命令
      if (command === 'execute' || command === 'e') {
        await executePlanInline(currentPlan);
        break;  // 执行完成后退出
      }
      // 退出命令
      else if (command === 'quit' || command === 'q') {
        console.log(chalk.gray('已退出'));
        break;
      }
      // 显示当前计划
      else if (command === 'show' || command === 's') {
        console.log();
        console.log(chalk.cyan('📋 当前计划：'));
        console.log();
        console.log(formatPlanForDisplay(currentPlan));
        continue;
      }
      // 空输入
      else if (!input.trim()) {
        console.log(chalk.yellow('⚠️  请输入有效的操作'));
        continue;
      }
      // 其他输入视为改进指令
      else {
        console.log();
        console.log(chalk.gray('🤖 正在处理修改...'));

        try {
          // 确保是版本化 ID
          const { basePlanId, version } = storage.parsePlanId(currentPlanId);
          if (!version) {
            // 迁移旧格式到 v1
            await storage.savePlanVersion(currentPlan, basePlanId, 1);
            currentPlanId = `${basePlanId}-v1`;
          }

          // 调用改进服务
          const result = await service.refinePlan(currentPlanId, input, sessionId);

          currentPlanId = result.newPlan.fullId;
          currentPlan = result.newPlan.plan;
          sessionId = result.session.sessionId;

          console.log();
          console.log(chalk.green(`✅ Plan 已更新：${result.newPlan.fullId}`));
          console.log();
          console.log(chalk.cyan('📋 改动说明：'));
          for (const change of result.changes) {
            console.log(chalk.gray(`  • ${change.description}`));
          }
          console.log();

          // 显示更新后的计划
          console.log(chalk.cyan(`📋 更新后的计划：`));
          console.log();
          console.log(formatPlanForDisplay(currentPlan));
        } catch (error) {
          console.log();
          console.log(chalk.red(`❌ 改进失败: ${error instanceof Error ? error.message : '未知错误'}`));
          console.log();
          console.log(chalk.yellow('💡 提示：请尝试更具体的描述，或输入 "execute" 执行，"quit" 退出'));
          console.log();
        }
      }
    }
  } finally {
    // 清理 SIGINT 监听器
    process.off('SIGINT', handleInterrupt);
  }
}

/**
 * 内联执行计划
 */
async function executePlanInline(plan: ExecutionPlan): Promise<void> {
  console.log();
  console.log(chalk.blue('🚀 开始执行计划...'));
  console.log();

  const executor = container.get<Executor>(Executor);

  const result = await executor.execute(plan);

  console.log(executor.formatResultForDisplay(result));

  if (result.success) {
    console.log();
    console.log(chalk.green(`✅ 执行成功！最终结果: ${JSON.stringify(result.finalResult)}`));
  } else {
    console.log();
    console.log(chalk.red('❌ 执行失败'));
    if (result.error) {
      console.log(chalk.red(`错误: ${result.error}`));
    }
  }
}

/**
 * 格式化 plan 用于显示
 */
function formatPlanForDisplay(plan: ExecutionPlan): string {
  const lines: string[] = [];

  lines.push(chalk.gray(`用户需求: ${plan.userRequest}`));
  lines.push(chalk.gray(`状态: ${plan.status === 'executable' ? '✅ 可执行' : '⚠️  不完整'}`));
  lines.push('');
  lines.push(chalk.white('步骤:'));

  for (const step of plan.steps) {
    if (isFunctionCallStep(step)) {
      const params = Object.entries(step.parameters)
        .map(([k, v]: [string, any]) => {
          if (v.type === 'reference') {
            return `${k}=\${${v.value}}`;
          }
          return `${k}=${JSON.stringify(v.value)}`;
        })
        .join(', ');

      lines.push(chalk.white(`  Step ${step.stepId}: ${step.functionName}(${params})`));
      if (step.description) {
        lines.push(chalk.gray(`    → ${step.description}`));
      }
    } else {
      // 用户输入步骤
      lines.push(chalk.white(`  Step ${step.stepId}: [User Input]`));
      if (step.description) {
        lines.push(chalk.gray(`    → ${step.description}`));
      }
    }
  }

  return lines.join('\n');
}
