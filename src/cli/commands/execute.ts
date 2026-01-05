import { input, confirm } from '@inquirer/prompts';
import container from '../../container/cli-container.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Executor } from '../../executor/index.js';
import { ExecutorImpl } from '../../executor/implementations/ExecutorImpl.js';
import { ConditionalExecutor } from '../../executor/implementations/ConditionalExecutor.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { StepType } from '../../planner/types.js';
import { A2UIService } from '../../a2ui/A2UIService.js';
import { A2UIRenderer } from '../../a2ui/A2UIRenderer.js';
import { loadFunctions } from '../utils.js';

interface ExecuteOptions {
  functions: string;
  yes: boolean;
}

export async function executeCommand(
  planId: string,
  options: ExecuteOptions
): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);
  
  try {
    ui.startSurface('execute');
    
    // 加载计划
    const storage = container.get<Storage>(Storage);
    const plan = await storage.loadPlan(planId);

    if (!plan) {
      ui.badge(`❌ 找不到计划: ${planId}`, 'error');
      ui.caption('使用 "npx fn-orchestrator list plans" 查看所有计划');
      ui.endSurface();
      return;
    }

    // 加载函数
    const functionProvider = container.get<FunctionProvider>(FunctionProvider);
    await loadFunctions(functionProvider, options.functions);

    // 加载 Plan 的 mock 函数
    if (plan.metadata?.usesMocks) {
      try {
        const planMocks = await storage.loadPlanMocks(planId);
        planMocks.forEach((fn) => {
          functionProvider.register?.(fn as any);
        });
        ui.caption(`已加载 ${planMocks.length} 个 plan-specific mock 函数`);
      } catch (error) {
        ui.badge(`⚠️ 无法加载 plan-specific mocks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      }
    }

    // 打印所有加载的函数
    const allFunctions = await functionProvider.list();
    ui.heading('📦 已加载的函数:');
    ui.caption(`总共 ${allFunctions.length} 个函数`);

    // 区分本地函数、远程函数和 mock 函数
    // 使用 type 字段（更稳定）而不是 source 字段
    const mockFunctions = plan.metadata?.mockFunctions || [];
    const mockFunctionNames = mockFunctions.map((m) => m.name);

    const localFunctions = allFunctions.filter(
      (f) => f.type === 'local' && !mockFunctionNames.includes(f.name)
    );
    const remoteFunctions = allFunctions.filter(
      (f) => f.type === 'remote' && !mockFunctionNames.includes(f.name)
    );
    const loadedMocks = allFunctions.filter((f) =>
      mockFunctionNames.includes(f.name)
    );

    if (localFunctions.length > 0) {
      ui.text('本地函数:', 'subheading');
      localFunctions.forEach(f => {
        ui.caption(`  • ${f.name}`);
      });
    }

    if (remoteFunctions.length > 0) {
      ui.text('远程工具:', 'subheading');
      remoteFunctions.forEach(f => {
        ui.caption(`  • ${f.name} (${f.source})`);
      });
    }

    if (loadedMocks.length > 0) {
      ui.text('Mock 函数:', 'subheading');
      loadedMocks.forEach(f => {
        ui.caption(`  • ${f.name} (mock)`);
      });
    }

    // 检查计划状态
    if (plan.status !== 'executable') {
      ui.badge('⚠️ 该计划不可执行', 'warning');
      if (plan.missingFunctions && plan.missingFunctions.length > 0) {
        ui.caption('缺少以下函数:');
        for (const fn of plan.missingFunctions) {
          ui.caption(`  - ${fn.name}: ${fn.description}`);
        }
      }

      // 检查计划需要的 mock 函数是否都已加载
      if (mockFunctions.length > 0) {
        const missingMocks = mockFunctions.filter(
          (mockRef) => !allFunctions.some((f) => f.name === mockRef.name)
        );

        if (missingMocks.length > 0) {
          ui.badge('⚠️ 计划需要但未加载的 mock 函数:', 'error');
          missingMocks.forEach((mockRef) => {
            ui.caption(`  • ${mockRef.name} (v${mockRef.version})`);
          });
          ui.caption('提示: 请重新运行 plan 命令生成这些 mock 函数');
        }
      }
      ui.endSurface();
      return;
    }

    // 从容器获取 Planner 用于显示计划
    const planner = container.get<Planner>(Planner);

    // 显示计划
    ui.heading('📋 执行计划:');
    ui.text(planner.formatPlanForDisplay(plan));

    ui.endSurface();

    // 确认执行 (使用 @inquirer/prompts)
    if (!options.yes) {
      const confirmed = await confirm({
        message: '确认执行此计划?',
        default: false,
      });

      if (!confirmed) {
        ui.startSurface('execute-cancelled');
        ui.caption('已取消执行');
        ui.endSurface();
        return;
      }
    }

    ui.startSurface('execute-running');
    ui.heading('🚀 开始执行...');

    // 获取 A2UIRenderer 用于处理用户输入
    const a2uiRenderer = container.get<A2UIRenderer>(A2UIRenderer);

    // 根据计划内容选择执行器
    const hasConditionSteps = plan.steps.some(step => step.type === StepType.CONDITION);
    const executor: Executor = hasConditionSteps
      ? new ConditionalExecutor(functionProvider, undefined, a2uiRenderer)
      : new ExecutorImpl(functionProvider, undefined, a2uiRenderer);

    if (hasConditionSteps) {
      ui.caption('ℹ️  检测到条件分支步骤，使用条件执行器');
    }

    const result = await executor.execute(plan);

    // 保存执行结果
    const execId = await storage.saveExecution(result);

    // 显示结果
    ui.text(executor.formatResultForDisplay(result));

    if (result.success) {
      ui.badge('✅ 执行成功!', 'success');
      ui.caption(`执行记录 ID: ${execId}`);
      ui.endSurface();
      process.exit(0);
    } else {
      ui.badge('❌ 执行失败', 'error');
      ui.caption(`执行记录 ID: ${execId}`);
      ui.endSurface();
      process.exit(1);
    }
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}
