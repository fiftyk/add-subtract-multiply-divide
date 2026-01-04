import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { OrchestrationService, type PlanSummary, type ExecutionSummary, type PlanResult, type RefineResult, type CreatePlanOptions } from '../interfaces/OrchestrationService.js';
import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';
import type { VersionedPlan, PlanChange, PlanChangeType } from '../../services/types.js';
import type { FunctionMetadata } from '../../function-provider/types.js';
import { Planner } from '../../planner/interfaces/IPlanner.js';
import { Executor } from '../../executor/interfaces/Executor.js';
import { Storage } from '../../storage/interfaces/Storage.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';
import { SessionStorage } from '../../services/storage/interfaces/SessionStorage.js';
import { PlanRefinementLLMClient } from '../../services/interfaces/IPlanRefinementLLMClient.js';
import { ConsoleLogger } from '../../logger/implementations.js';
import { LoggerFactory } from '../../logger/index.js';
import { PlannerWithMockSupport } from '../../function-completion/decorators/PlannerWithMockSupport.js';
import { MockServiceFactory } from '../../function-completion/factory/MockServiceFactory.js';
import { ConfigManager } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 编排服务实现
 *
 * 职责：
 * - 组合 Planner、Executor、Storage 等核心服务
 * - 提供统一 API 给 CLI 和 Web 使用
 * - 处理函数加载等基础设施操作
 */
@injectable()
export class OrchestrationServiceImpl implements OrchestrationService {
  private logger: ConsoleLogger;

  constructor(
    @inject(Planner) private planner: Planner,
    @inject(Executor) private executor: Executor,
    @inject(Storage) private storage: Storage,
    @inject(FunctionProvider) private functionProvider: FunctionProvider,
    @inject(SessionStorage) private sessionStorage: SessionStorage,
    @inject(PlanRefinementLLMClient) private refinementLLMClient: PlanRefinementLLMClient,
    @inject(MockServiceFactory) private mockServiceFactory: MockServiceFactory
  ) {
    this.logger = LoggerFactory.create() as ConsoleLogger;
  }

  /**
   * 创建支持 mock 自动补全的 Planner
   */
  private getPlannerWithAutoComplete(enableAutoComplete?: boolean, maxRetries?: number): Planner {
    if (!enableAutoComplete) {
      return this.planner;
    }

    const config = ConfigManager.get();
    const completionConfig: { maxIterations: number } = { maxIterations: maxRetries ?? config.functionCompletion.maxRetries };

    // 创建 orchestrator（需要 planId，我们使用占位符）
    const orchestrator = this.mockServiceFactory.createOrchestrator('temp');

    return new PlannerWithMockSupport(
      this.planner,
      orchestrator,
      this.functionProvider,
      completionConfig as any,
      this.logger
    );
  }

  async createPlan(request: string, options?: CreatePlanOptions): Promise<PlanResult> {
    this.logger.info('创建计划', { request: request.slice(0, 50) + '...' });

    const plannerWithAutoComplete = this.getPlannerWithAutoComplete(
      options?.enableAutoComplete,
      options?.maxRetries
    );

    const result = await plannerWithAutoComplete.plan(request);

    if (!result.success || !result.plan) {
      return {
        success: false,
        error: result.error || '创建计划失败',
      };
    }

    // 保存计划
    await this.storage.savePlan(result.plan);

    return {
      success: true,
      plan: result.plan,
    };
  }

  async getPlan(planId: string): Promise<ExecutionPlan | undefined> {
    return this.storage.loadPlan(planId);
  }

  async listPlans(): Promise<PlanSummary[]> {
    const plans = await this.storage.listPlans();
    return plans.map((plan) => ({
      id: plan.id,
      userRequest: plan.userRequest,
      status: plan.status,
      stepCount: plan.steps.length,
      createdAt: plan.createdAt,
      updatedAt: plan.createdAt,
    }));
  }

  async deletePlan(planId: string): Promise<boolean> {
    try {
      // 委托给 Storage 层处理
      await this.storage.deletePlanWithMocks(planId);
      await this.storage.deleteExecutionsByPlanId(planId);

      this.logger.info('删除计划', { planId });
      return true;
    } catch (error) {
      this.logger.error('删除计划失败', error as Error, { planId });
      return false;
    }
  }

  async executePlan(planId: string): Promise<ExecutionResult> {
    const plan = await this.storage.loadPlan(planId);
    if (!plan) {
      return this.createFailedExecutionResult(planId, '计划不存在');
    }

    if (plan.status !== 'executable') {
      return this.createFailedExecutionResult(planId, '计划不可执行');
    }

    // 加载 mock 函数（如果需要）
    if (plan.metadata?.usesMocks) {
      try {
        const mocks = await this.storage.loadPlanMocks(planId);
        for (const mock of mocks) {
          this.functionProvider.register?.(mock as any);
        }
      } catch (error) {
        this.logger.warn('加载 mock 函数失败', { error: String(error) });
      }
    }

    this.logger.info('执行计划', { planId });

    // 使用适当的执行器（普通或条件执行）
    const hasConditionSteps = plan.steps.some((s) => s.type === 'condition');

    // 动态导入以避免循环依赖
    let executorToUse = this.executor;
    if (hasConditionSteps) {
      const { ConditionalExecutor } = await import('../../executor/implementations/ConditionalExecutor.js');
      executorToUse = new ConditionalExecutor(this.functionProvider);
    }

    const result = await executorToUse.execute(plan);

    // 保存执行结果
    await this.storage.saveExecution(result);

    return result;
  }

  private createFailedExecutionResult(planId: string, error: string): ExecutionResult {
    return {
      planId,
      steps: [],
      finalResult: undefined,
      success: false,
      error,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  async getExecution(execId: string): Promise<ExecutionResult | undefined> {
    return this.storage.loadExecution(execId);
  }

  async listExecutions(): Promise<ExecutionSummary[]> {
    const results = await this.storage.listExecutions();
    return results.map((result) => ({
      id: this.getExecIdFromResult(result),
      planId: result.planId,
      success: result.success,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    }));
  }

  /**
   * 从执行结果中提取 execId（从 planId 推断）
   */
  private getExecIdFromResult(result: ExecutionResult): string {
    // ExecutionResult 没有存储 execId，需要从文件名推断
    // 这里简化处理，返回一个占位符
    return `exec-${result.planId.replace('plan-', '')}`;
  }

  async refinePlan(planId: string, instruction: string): Promise<RefineResult> {
    this.logger.info('改进计划', { planId, instruction: instruction.slice(0, 50) + '...' });

    // 解析 plan ID（支持 plan-xxx 和 plan-xxx-v1 格式）
    const { basePlanId, version } = this.storage.parsePlanId(planId);

    // 加载当前计划
    let currentPlan: ExecutionPlan;
    if (version) {
      const versioned = await this.storage.loadPlanVersion(basePlanId, version);
      if (!versioned) {
        return { success: false, error: '计划版本不存在' };
      }
      currentPlan = versioned;
    } else {
      const latest = await this.storage.loadLatestPlanVersion(basePlanId);
      if (!latest) {
        return { success: false, error: '计划不存在' };
      }
      currentPlan = latest.plan;
    }

    // 调用 LLM 进行改进
    const refinementResult = await this.refinementLLMClient.refinePlan({
      currentPlan,
      refinementInstruction: instruction,
      conversationHistory: [],
      availableFunctions: await this.functionProvider.list(),
    });

    // 生成新版本
    const newVersion = version ? version + 1 : 2;
    const newPlan: ExecutionPlan = {
      ...refinementResult.refinedPlan,
      id: `plan-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };

    // 保存新版本
    await this.storage.savePlanVersion(newPlan, basePlanId, newVersion);

    // 解析改动
    const changes = this.parseChanges(refinementResult.changes);

    return {
      success: true,
      plan: {
        basePlanId,
        version: newVersion,
        fullId: `${basePlanId}-v${newVersion}`,
        plan: newPlan,
        parentVersion: version,
        refinementInstruction: instruction,
        createdAt: newPlan.createdAt,
      },
      changes,
    };
  }

  private parseChanges(rawChanges: Array<{ type?: string; stepId?: number; description?: string; before?: unknown; after?: unknown }>): PlanChange[] {
    if (!rawChanges || !Array.isArray(rawChanges)) {
      return [];
    }
    return rawChanges.map((change) => ({
      type: (change.type as PlanChangeType) || 'step_modified',
      stepId: change.stepId,
      description: change.description || '',
      before: change.before,
      after: change.after,
    }));
  }

  async getPlanHistory(planId: string): Promise<VersionedPlan[]> {
    const { basePlanId } = this.storage.parsePlanId(planId);
    const versions = await this.storage.listPlanVersions(basePlanId);

    const history: VersionedPlan[] = [];
    for (const v of versions) {
      const plan = await this.storage.loadPlanVersion(basePlanId, v);
      if (plan) {
        history.push({
          basePlanId,
          version: v,
          fullId: `${basePlanId}-v${v}`,
          plan,
          createdAt: plan.createdAt,
        });
      }
    }

    return history.sort((a, b) => a.version - b.version);
  }

  async listFunctions(): Promise<FunctionMetadata[]> {
    return this.functionProvider.list();
  }

  async loadFunctions(path: string): Promise<void> {
    try {
      // 动态加载函数模块（使用 fileURLToPath 支持绝对路径）
      const { pathToFileURL } = await import('url');
      const modulePath = path.startsWith('.') ? path : path;
      const moduleUrl = path.startsWith('/') ? `file://${path}` : pathToFileURL(modulePath).href;
      const module = await import(moduleUrl);

      // 导出格式: { func1, func2, ... } 或 { default: { func1, func2 } }
      const functions = module.default || module;

      for (const [name, func] of Object.entries(functions)) {
        if (name === 'default' || name.startsWith('_')) continue;
        const definition = func as { name: string };
        if (definition && typeof definition === 'object' && definition.name) {
          this.functionProvider.register?.(definition as any);
        }
      }

      this.logger.info('加载函数', { path, count: Object.keys(functions).length });
    } catch (error) {
      this.logger.error('加载函数失败', error as Error, { path });
      throw error;
    }
  }
}
