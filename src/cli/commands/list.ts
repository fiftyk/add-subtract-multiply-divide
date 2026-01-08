import container from '../../container/cli-container.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { Storage } from '../../storage/index.js';
import { Planner } from '../../planner/index.js';
import { A2UIService } from '../../a2ui/A2UIService.js';
import { loadFunctions } from '../utils.js';

interface ListFunctionsOptions {
  functions: string;
}

/**
 * List Command - 列表查询命令
 * 
 * 使用工厂函数模式手动解析依赖，避免循环导入问题
 */
export class ListCommand {
  constructor(
    private ui: A2UIService,
    private functionProvider: FunctionProvider,
    private storage: Storage,
    private planner: Planner
  ) {}

  async functions(options: ListFunctionsOptions): Promise<void> {
    try {
      this.ui.startSurface('list-functions');

      await loadFunctions(this.functionProvider, options.functions);
      const allFunctions = await this.functionProvider.list();

      if (allFunctions.length === 0) {
        this.ui.badge('没有找到已注册的函数', 'warning');
        this.ui.caption(`请检查函数定义文件: ${options.functions}`);
        this.ui.endSurface();
        process.exit(1);
      }

      const localFunctions = allFunctions.filter(f => f.source === 'local');
      const remoteFunctions = allFunctions.filter(f => f.source !== 'local');

      if (localFunctions.length > 0) {
        this.ui.heading(`📚 本地函数 (${localFunctions.length} 个):`);
        for (const func of localFunctions) {
          this.ui.text(`- ${func.name}: ${func.description}`);
          if (func.scenario) {
            this.ui.caption(`  使用场景: ${func.scenario}`);
          }
          this.ui.caption('  参数:');
          for (const param of func.parameters) {
            this.ui.caption(`    - ${param.name} (${param.type}): ${param.description}`);
          }
          this.ui.caption(`  返回值: ${func.returns.type} - ${func.returns.description}`);
        }
      }

      if (remoteFunctions.length > 0) {
        this.ui.heading(`🔗 远程函数 (${remoteFunctions.length} 个):`);
        for (const func of remoteFunctions) {
          this.ui.text(`- ${func.name}`, 'subheading');
          this.ui.caption(`  来源: ${func.source}`);
          this.ui.caption(`  描述: ${func.description}`);
          this.ui.caption('  参数:');
          if (func.parameters.length === 0) {
            this.ui.caption('    (无参数)');
          } else {
            for (const param of func.parameters) {
              this.ui.caption(`    - ${param.name} (${param.type}): ${param.description}`);
            }
          }
          this.ui.caption(`  返回类型: ${func.returns.type}`);
          if (func.returns.description) {
            this.ui.caption(`  返回描述: ${func.returns.description}`);
          }
        }
      }

      this.ui.heading(`📊 总计: ${localFunctions.length} 个本地函数, ${remoteFunctions.length} 个远程函数`);
      this.ui.endSurface();
      process.exit(0);
    } catch (error) {
      this.ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      this.ui.endSurface();
      process.exit(1);
    }
  }

  async plans(): Promise<void> {
    try {
      this.ui.startSurface('list-plans');
      const plans = await this.storage.listPlans();

      if (plans.length === 0) {
        this.ui.badge('没有保存的执行计划', 'warning');
        this.ui.endSurface();
        process.exit(0);
      }

      this.ui.heading(`📋 执行计划列表 (${plans.length} 个):`);

      for (const plan of plans) {
        const statusIcon = plan.status === 'executable' ? '✅' : '⚠️';
        this.ui.text(`${statusIcon} ${plan.id} - ${plan.userRequest}`, 'subheading');
        this.ui.caption(`   创建时间: ${plan.createdAt} | 步骤数: ${plan.steps.length}`);
      }

      this.ui.endSurface();
      process.exit(0);
    } catch (error) {
      this.ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      this.ui.endSurface();
      process.exit(1);
    }
  }

  async showPlan(planId: string): Promise<void> {
    try {
      this.ui.startSurface('show-plan');
      const plan = await this.storage.loadPlan(planId);

      if (!plan) {
        this.ui.badge(`❌ 找不到计划: ${planId}`, 'error');
        this.ui.endSurface();
        process.exit(1);
      }

      this.ui.text(this.planner.formatPlanForDisplay(plan));
      this.ui.endSurface();
      process.exit(0);
    } catch (error) {
      this.ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
      this.ui.endSurface();
      process.exit(1);
    }
  }
}

// 工厂函数 - 手动解析依赖
function createListCommand(): ListCommand {
  return new ListCommand(
    container.get<A2UIService>(A2UIService),
    container.get<FunctionProvider>(FunctionProvider),
    container.get<Storage>(Storage),
    container.get<Planner>(Planner)
  );
}

// 便捷导出
export const listCommand = {
  async functions(options: ListFunctionsOptions): Promise<void> {
    return createListCommand().functions(options);
  },
  async plans(): Promise<void> {
    return createListCommand().plans();
  },
  async showPlan(planId: string): Promise<void> {
    return createListCommand().showPlan(planId);
  },
};
