import { input } from '@inquirer/prompts';
import { v4 as uuidv4 } from 'uuid';
import container, { MockServiceFactory } from '../../container/cli-container.js';
import { FunctionProvider } from '@fn-orchestrator/core/function-provider/interfaces/FunctionProvider.js';
import { Planner } from '@fn-orchestrator/core/planner';
import { Storage } from '@fn-orchestrator/core/storage';
import { Executor } from '@fn-orchestrator/core/executor';
import { loadFunctions } from '../utils.js';
import { PlannerWithMockSupport } from '@fn-orchestrator/core/function-completion';
import { ConfigManager } from '@fn-orchestrator/core/config';
import { LoggerFactory } from '@fn-orchestrator/core/logger';
import { InteractivePlanService, PlanRefinementLLMClient, PlanRefinementSessionStorage } from '@fn-orchestrator/core/services';
import type { ExecutionPlan } from '@fn-orchestrator/core/planner/types.js';
import { isFunctionCallStep } from '@fn-orchestrator/core/planner/type-guards.js';
import type { AppConfig } from '@fn-orchestrator/core/config/types.js';
import { A2UIService } from '@fn-orchestrator/core/a2ui/A2UIService.js';

interface PlanOptions {
  functions: string;
  interactive?: boolean;
}

/**
 * Plan Command - 规划执行计划
 */
export class PlanCommand {
  constructor(
    private ui: A2UIService,
    private functionProvider: FunctionProvider,
    private basePlanner: Planner,
    private storage: Storage,
    private executor: Executor,
    private sessionStorage: PlanRefinementSessionStorage,
    private refinementLLMClient: PlanRefinementLLMClient
  ) {}

  async execute(request: string, options: PlanOptions): Promise<void> {
    try {
      this.ui.startSurface('plan');
      this.ui.heading('📝 正在分析需求...');
      this.ui.caption(`用户需求: ${request}`);

      const config = ConfigManager.get();
      await loadFunctions(this.functionProvider, options.functions);

      const allFunctions = await this.functionProvider.list();
      if (allFunctions.length === 0) {
        this.ui.badge('⚠️ 没有找到已注册的函数', 'warning');
        this.ui.caption(`请确保函数定义文件存在: ${options.functions}`);
        this.ui.endSurface();
        return;
      }

      const builtinFunctions = allFunctions.filter(f => f.source === 'local');
      const mcpFunctions = allFunctions.filter(f => f.source.includes('mcp') || f.source.includes('remote'));
      const mockFunctions = allFunctions.filter(f =>
        f.source !== 'local' && !f.source.includes('mcp') && !f.source.includes('remote')
      );

      this.ui.caption(`已加载 ${allFunctions.length} 个函数:`);
      if (builtinFunctions.length > 0) {
        this.ui.caption(`  📚 本地函数: ${builtinFunctions.map(f => f.name).join(', ')}`);
      }
      if (mcpFunctions.length > 0) {
        this.ui.text(`  🔗 MCP 工具: ${mcpFunctions.map(f => f.name).join(', ')}`, 'subheading');
      }
      if (mockFunctions.length > 0) {
        this.ui.text(`  🎭 Mock 函数: ${mockFunctions.map(f => f.name).join(', ')}`, 'subheading');
      }

      const logger = LoggerFactory.createFromEnv();
      let planner: Planner | PlannerWithMockSupport = this.basePlanner;
      const planId = `plan-${uuidv4().slice(0, 8)}`;

      if (config.functionCompletion.enabled) {
        logger.info('✨ 函数自动补全已启用', { maxRetries: config.functionCompletion.maxRetries });
        const mockServiceFactory = container.get<MockServiceFactory>(MockServiceFactory);
        const mockOrchestrator = mockServiceFactory.createOrchestrator(planId);
        planner = new PlannerWithMockSupport(
          this.basePlanner,
          mockOrchestrator,
          this.functionProvider,
          { maxIterations: config.functionCompletion.maxRetries },
          logger
        );
      } else {
        logger.info('ℹ️ 函数自动补全已禁用');
      }

      const result = await planner.plan(request);

      if (!result.success || !result.plan) {
        this.ui.badge(`❌ 规划失败: ${result.error}`, 'error');
        this.ui.endSurface();
        process.exit(1);
      }

      result.plan.id = planId;
      await this.storage.savePlan(result.plan);

      this.ui.badge('✅ 计划生成成功！', 'success');
      this.ui.text(this.basePlanner.formatPlanForDisplay(result.plan));

      if (result.plan.metadata?.usesMocks) {
        this.ui.badge('⚠️ 此计划使用了 MOCK 数据，结果仅供测试', 'warning');
        const mockFunctionNames = result.plan.metadata.mockFunctions?.map((f: { name: string }) => f.name).join(', ') || '';
        this.ui.caption(`📁 Mock functions: ${mockFunctionNames}`);
        const mockDir = this.storage.getPlanMocksDir(result.plan.id);
        this.ui.text(`💡 提示: 编辑 ${mockDir} 中的文件来实现真实逻辑`, 'subheading');
      }

      this.ui.endSurface();

      if (result.plan.status === 'executable') {
        if (options.interactive) {
          await this.interactivePlanFlow(result.plan, config);
        } else {
          this.ui.startSurface('plan-done');
          this.ui.text(`执行命令: npx fn-orchestrator execute ${result.plan.id}`, 'subheading');
          this.ui.endSurface();
          process.exit(0);
        }
      } else {
        this.ui.startSurface('plan-incomplete');
        this.ui.badge('⚠️ 计划不完整，请先实现缺失的函数', 'warning');
        if (!config.functionCompletion.enabled && result.plan?.missingFunctions?.length) {
          this.ui.text(`💡 提示: 缺少 ${result.plan.missingFunctions.length} 个函数`, 'subheading');
          this.ui.caption('使用 --auto-complete 标志可以自动生成缺失函数的实现');
        }
        this.ui.endSurface();
        process.exit(1);
      }
    } catch (error) {
      this.ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      this.ui.endSurface();
      process.exit(1);
    }
  }

  private async interactivePlanFlow(plan: ExecutionPlan, config: AppConfig): Promise<void> {
    let currentPlan = plan;
    let currentPlanId = plan.id;

    const handleInterrupt = () => {
      this.ui.startSurface('plan-interrupted');
      this.ui.badge('👋 用户中断，已退出', 'warning');
      this.ui.endSurface();
      process.exit(0);
    };
    process.on('SIGINT', handleInterrupt);

    const service = new InteractivePlanService(
      this.basePlanner,
      this.storage,
      this.sessionStorage,
      this.refinementLLMClient,
      this.functionProvider
    );

    let sessionId: string | undefined;

    try {
      while (true) {
        this.ui.startSurface('plan-interactive');
        this.ui.divider();

        const userInput = await input({
          message: '请输入操作（改进指令 / "execute"(e) 执行 / "show"(s) 查看 / "quit"(q) 退出）：',
        });

        const command = userInput.trim().toLowerCase();

        if (command === 'execute' || command === 'e') {
          await this.executePlanInline(currentPlan);
          break;
        } else if (command === 'quit' || command === 'q') {
          this.ui.caption('已退出');
          this.ui.endSurface();
          break;
        } else if (command === 'show' || command === 's') {
          this.ui.heading('📋 当前计划：');
          this.ui.text(this.formatPlanForDisplay(currentPlan));
          this.ui.endSurface();
          continue;
        } else if (!userInput.trim()) {
          this.ui.badge('⚠️ 请输入有效的操作', 'warning');
          this.ui.endSurface();
          continue;
        } else {
          this.ui.caption('🤖 正在处理修改...');

          try {
            const { basePlanId, version } = this.storage.parsePlanId(currentPlanId);
            if (!version) {
              await this.storage.savePlanVersion(currentPlan, basePlanId, 1);
              currentPlanId = `${basePlanId}-v1`;
            }

            const result = await service.refinePlan(currentPlanId, userInput, sessionId);
            currentPlanId = result.newPlan.fullId;
            currentPlan = result.newPlan.plan;
            sessionId = result.session.sessionId;

            this.ui.badge(`✅ Plan 已更新：${result.newPlan.fullId}`, 'success');
            this.ui.heading('📋 改动说明：');
            for (const change of result.changes) {
              this.ui.caption(`  • ${change.description}`);
            }
            this.ui.heading('📋 更新后的计划：');
            this.ui.text(this.formatPlanForDisplay(currentPlan));
          } catch (error) {
            this.ui.badge(`❌ 改进失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
            this.ui.caption('💡 提示：请尝试更具体的描述，或输入 "execute" 执行，"quit" 退出');
          }
          this.ui.endSurface();
        }
      }
    } finally {
      process.off('SIGINT', handleInterrupt);
    }
  }

  private async executePlanInline(plan: ExecutionPlan): Promise<void> {
    this.ui.startSurface('plan-execute');
    this.ui.heading('🚀 开始执行计划...');

    const result = await this.executor.execute(plan);
    this.ui.text(this.executor.formatResultForDisplay(result));

    if (result.success) {
      this.ui.badge(`✅ 执行成功！最终结果: ${JSON.stringify(result.finalResult)}`, 'success');
    } else {
      this.ui.badge('❌ 执行失败', 'error');
      if (result.error) {
        this.ui.caption(`错误: ${result.error}`);
      }
    }
    this.ui.endSurface();
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
            if (v.type === 'reference') return `${k}=\${${v.value}}`;
            return `${k}=${JSON.stringify(v.value)}`;
          }).join(', ');
        lines.push(`  Step ${step.stepId}: ${step.functionName}(${params})`);
      } else {
        lines.push(`  Step ${step.stepId}: [User Input]`);
      }
      if (step.description) lines.push(`    → ${step.description}`);
    }
    return lines.join('\n');
  }
}

// 工厂函数
function createPlanCommand(): PlanCommand {
  return new PlanCommand(
    container.get<A2UIService>(A2UIService),
    container.get<FunctionProvider>(FunctionProvider),
    container.get<Planner>(Planner),
    container.get<Storage>(Storage),
    container.get<Executor>(Executor),
    container.get<PlanRefinementSessionStorage>(PlanRefinementSessionStorage),
    container.get<PlanRefinementLLMClient>(PlanRefinementLLMClient)
  );
}

// 便捷导出
export async function planCommand(request: string, options: PlanOptions): Promise<void> {
  return createPlanCommand().execute(request, options);
}
