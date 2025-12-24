import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  InteractivePlanService,
  SessionStorage,
  AnthropicPlanRefinementLLMClient,
} from '../../services/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/planner.js';
import { AnthropicPlannerLLMClient } from '../../planner/adapters/AnthropicPlannerLLMClient.js';
import { FunctionRegistry } from '../../registry/index.js';
import { LocalFunctionToolProvider } from '../../remote/index.js';
import { ConfigManager } from '../../config/index.js';

interface RefineOptions {
  prompt?: string;  // 单次改进指令
  session?: string;      // 继续现有 session
}

/**
 * 交互式改进 plan 的命令
 *
 * 用法：
 *   npx fn-orchestrator refine plan-abc-v1
 *   npx fn-orchestrator refine plan-abc     # 默认使用最新版��
 *   npx fn-orchestrator refine plan-abc -p "把第2步改成除以2"
 */
export async function refineCommand(
  planId: string,
  options: RefineOptions
): Promise<void> {
  try {
    const config = ConfigManager.get();

    // 创建 service
    const registry = new FunctionRegistry();
    const storage = new Storage(config.storage.dataDir);
    const sessionStorage = new SessionStorage(config.storage.dataDir);

    const llmClient = new AnthropicPlannerLLMClient({
      apiKey: config.api.apiKey,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
      baseURL: config.api.baseURL,
    });

    const toolProvider = new LocalFunctionToolProvider(registry);
    const planner = new Planner(toolProvider, registry, llmClient);

    const refinementLLMClient = new AnthropicPlanRefinementLLMClient({
      apiKey: config.api.apiKey,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
      baseURL: config.api.baseURL,
    });

    const service = new InteractivePlanService(
      planner,
      storage,
      sessionStorage,
      refinementLLMClient,
      registry
    );

    // 解析 plan ID
    const { basePlanId, version } = storage.parsePlanId(planId);

    // 加载 plan
    let currentPlanId = planId;
    let currentVersion: number;
    let currentPlan;

    if (version) {
      currentPlan = await storage.loadPlanVersion(basePlanId, version);
      currentVersion = version;
    } else {
      // 尝试加载最新版本
      const latest = await storage.loadLatestPlanVersion(basePlanId);
      if (latest) {
        currentPlan = latest.plan;
        currentVersion = latest.version;
        currentPlanId = `${basePlanId}-v${currentVersion}`;
      } else {
        // 如果没有版本化的 plan，尝试加载旧格式的 plan
        const legacyPlan = await storage.loadPlan(basePlanId);
        if (legacyPlan) {
          // 将旧 plan 迁移到版本化格式（保存为 v1）
          await storage.savePlanVersion(legacyPlan, basePlanId, 1);
          currentPlan = legacyPlan;
          currentVersion = 1;
          currentPlanId = `${basePlanId}-v1`;
          console.log(chalk.yellow(`📦 已将旧格式计划迁移为版本化格式: ${currentPlanId}`));
          console.log();
        } else {
          console.log(chalk.red(`❌ 找不到计划: ${planId}`));
          console.log(chalk.gray('使用 "npx fn-orchestrator list plans" 查看所有计划'));
          process.exit(1);
        }
      }
    }

    if (!currentPlan) {
      console.log(chalk.red(`❌ 找不到计划: ${planId}`));
      process.exit(1);
    }

    // 如果提供了单次改进指令，直接执行
    if (options.prompt) {
      const result = await service.refinePlan(
        currentPlanId,
        options.prompt,
        options.session
      );

      console.log(chalk.green(`✅ Plan 已更新：${result.newPlan.fullId}`));
      console.log();
      console.log(chalk.cyan('📋 改动说明：'));
      for (const change of result.changes) {
        console.log(chalk.gray(`  • ${change.description}`));
      }
      console.log();
      console.log(chalk.blue(`💾 执行命令: npx fn-orchestrator execute ${result.newPlan.fullId}`));
      process.exit(0);
    }

    // 进入交互模式
    console.log(chalk.blue('📝 交互式 Plan 改进模式'));
    console.log();

    // 显示当前 plan
    console.log(chalk.cyan(`📋 当前计划：${currentPlanId}`));
    console.log();
    console.log(formatPlanForDisplay(currentPlan));
    console.log();

    // 多轮改进循环
    let sessionId = options.session;
    let iterationCount = 0;

    while (true) {
      iterationCount++;
      console.log(chalk.gray(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      console.log();

      const { instruction } = await inquirer.prompt([{
        type: 'input',
        name: 'instruction',
        message: '请描述你想做的修改（输入 "done" 完成，"quit" 退出）：',
      }]);

      if (instruction.toLowerCase() === 'done' || instruction.toLowerCase() === 'quit') {
        console.log();
        console.log(chalk.green(`✅ 改进完成！最终计划：${currentPlanId}`));
        console.log(chalk.blue(`💾 执行命令: npx fn-orchestrator execute ${currentPlanId}`));
        break;
      }

      if (!instruction.trim()) {
        console.log(chalk.yellow('⚠️  请输入有效的修改指令'));
        continue;
      }

      console.log();
      console.log(chalk.gray('🤖 正在处理修改...'));

      try {
        // 调用 service 进行改进
        const result = await service.refinePlan(currentPlanId, instruction, sessionId);

        // 更新当前信息
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

        // 显示更新后的 plan
        console.log(chalk.cyan(`📋 更新后的计划：`));
        console.log();
        console.log(formatPlanForDisplay(currentPlan));
        console.log();

      } catch (error) {
        console.log();
        console.log(chalk.red(`❌ 改进失败: ${error instanceof Error ? error.message : '未知错误'}`));
        console.log();
        console.log(chalk.yellow('💡 提示：请尝试更具体的描述，或输入 "done" 退出'));
        console.log();
      }
    }

    process.exit(0);

  } catch (error) {
    console.error(
      chalk.red(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`)
    );
    process.exit(1);
  }
}

/**
 * 格式化 plan 用于显示
 */
function formatPlanForDisplay(plan: any): string {
  const lines: string[] = [];

  lines.push(chalk.gray(`用户需求: ${plan.userRequest}`));
  lines.push(chalk.gray(`状态: ${plan.status === 'executable' ? '✅ 可执行' : '⚠️  不完整'}`));
  lines.push('');
  lines.push(chalk.white('步骤:'));

  for (const step of plan.steps) {
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
  }

  return lines.join('\n');
}
