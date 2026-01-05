import { injectable, inject } from 'inversify';
import inquirer from 'inquirer';
import container from '../../container/cli-container.js';
import {
  InteractivePlanService,
  SessionStorage,
} from '../../services/index.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { PlanRefinementLLMClient } from '../../services/interfaces/IPlanRefinementLLMClient.js';
import { A2UIService } from '../../a2ui/A2UIService.js';
import type { ExecutionPlan } from '../../planner/types.js';
import { isFunctionCallStep } from '../../planner/type-guards.js';

interface RefineOptions {
  prompt?: string;
  session?: string;
}

/**
 * Refine Command - 交互式改进 plan
 */
@injectable()
export class RefineCommand {
  private service: InteractivePlanService;

  constructor(
    @inject(A2UIService) private ui: A2UIService,
    @inject(Storage) private storage: Storage,
    @inject(SessionStorage) private sessionStorage: SessionStorage,
    @inject(Planner) private planner: Planner,
    @inject(PlanRefinementLLMClient) private refinementLLMClient: PlanRefinementLLMClient,
    @inject(FunctionProvider) private functionProvider: FunctionProvider
  ) {
    this.service = new InteractivePlanService(
      planner,
      storage,
      sessionStorage,
      refinementLLMClient,
      functionProvider
    );
  }

  async execute(planId: string, options: RefineOptions): Promise<void> {
    try {
      this.ui.startSurface('refine');

      const { basePlanId, version } = this.storage.parsePlanId(planId);
      let currentPlanId = planId;
      let currentVersion: number;
      let currentPlan: ExecutionPlan | undefined;

      if (version) {
        currentPlan = await this.storage.loadPlanVersion(basePlanId, version);
        currentVersion = version;
      } else {
        const latest = await this.storage.loadLatestPlanVersion(basePlanId);
        if (latest) {
          currentPlan = latest.plan;
          currentVersion = latest.version;
          currentPlanId = `${basePlanId}-v${currentVersion}`;
        } else {
          const legacyPlan = await this.storage.loadPlan(basePlanId);
          if (legacyPlan) {
            await this.storage.savePlanVersion(legacyPlan, basePlanId, 1);
            currentPlan = legacyPlan;
            currentVersion = 1;
            currentPlanId = `${basePlanId}-v1`;
            this.ui.badge(`📦 已将旧格式计划迁移为版本化格式: ${currentPlanId}`, 'info');
          } else {
            this.ui.badge(`❌ 找不到计划: ${planId}`, 'error');
            this.ui.caption('使用 "npx fn-orchestrator list plans" 查看所有计划');
            this.ui.endSurface();
            process.exit(1);
          }
        }
      }

      if (!currentPlan) {
        this.ui.badge(`❌ 找不到计划: ${planId}`, 'error');
        this.ui.endSurface();
        process.exit(1);
      }

      // 单次改进模式
      if (options.prompt) {
        const result = await this.service.refinePlan(currentPlanId, options.prompt, options.session);
        
        this.ui.badge(`✅ Plan 已更新：${result.newPlan.fullId}`, 'success');
        this.ui.heading('📋 改动说明：');
        for (const change of result.changes) {
          this.ui.caption(`  • ${change.description}`);
        }
        this.ui.text(`💾 执行命令: npx fn-orchestrator execute ${result.newPlan.fullId}`);
        this.ui.endSurface();
        process.exit(0);
      }

      // 交互模式
      this.ui.heading('📝 交互式 Plan 改进模式');
      this.ui.text(`📋 当前计划：${currentPlanId}`, 'subheading');
      this.ui.text(this.formatPlanForDisplay(currentPlan));
      this.ui.endSurface();

      let sessionId = options.session;

      while (true) {
        const { instruction } = await inquirer.prompt([{
          type: 'input',
          name: 'instruction',
          message: '请描述你想做的修改（输入 "done" 完成，"quit" 退出）：',
        }]);

        if (instruction.toLowerCase() === 'done' || instruction.toLowerCase() === 'quit') {
          this.ui.startSurface('refine-done');
          this.ui.badge(`✅ 改进完成！最终计划：${currentPlanId}`, 'success');
          this.ui.text(`💾 执行命令: npx fn-orchestrator execute ${currentPlanId}`);
          this.ui.endSurface();
          break;
        }

        if (!instruction.trim()) {
          this.ui.startSurface('refine-warning');
          this.ui.badge('⚠️ 请输入有效的修改指令', 'warning');
          this.ui.endSurface();
          continue;
        }

        this.ui.startSurface('refine-processing');
        this.ui.caption('🤖 正在处理修改...');

        try {
          const result = await this.service.refinePlan(currentPlanId, instruction, sessionId);
          currentPlanId = result.newPlan.fullId;
          currentPlan = result.newPlan.plan;
          sessionId = result.session.sessionId;

          this.ui.badge(`✅ Plan 已更新：${result.newPlan.fullId}`, 'success');
          this.ui.heading('📋 改动说明：');
          for (const change of result.changes) {
            this.ui.caption(`  • ${change.description}`);
          }
          this.ui.text('📋 更新后的计划：', 'subheading');
          this.ui.text(this.formatPlanForDisplay(currentPlan));
          this.ui.endSurface();
        } catch (error) {
          this.ui.badge(`❌ 改进失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
          this.ui.caption('💡 提示：请尝试更具体的描述，或输入 "done" 退出');
          this.ui.endSurface();
        }
      }

      process.exit(0);
    } catch (error) {
      this.ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      this.ui.endSurface();
      process.exit(1);
    }
  }

  private formatPlanForDisplay(plan: ExecutionPlan): string {
    const lines: string[] = [];
    lines.push(`用户需求: ${plan.userRequest}`);
    lines.push(`状态: ${plan.status === 'executable' ? '✅ 可执行' : '⚠️ 不完整'}`);
    lines.push('');
    lines.push('步骤:');

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
        lines.push(`  Step ${step.stepId}: ${step.functionName}(${params})`);
      } else {
        lines.push(`  Step ${step.stepId}: [User Input]`);
      }
      if (step.description) {
        lines.push(`    → ${step.description}`);
      }
    }

    return lines.join('\n');
  }
}

// 便捷导出
export async function refineCommand(planId: string, options: RefineOptions): Promise<void> {
  const cmd = container.get(RefineCommand);
  return cmd.execute(planId, options);
}
