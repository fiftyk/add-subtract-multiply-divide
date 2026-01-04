import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';
import type { VersionedPlan, PlanChange, PlanChangeType } from '../../services/types.js';
import type { FunctionMetadata } from '../../function-provider/types.js';

/**
 * 计划摘要（用于列表展示）
 */
export interface PlanSummary {
  id: string;
  userRequest: string;
  status: 'pending' | 'executable' | 'incomplete';
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 执行摘要（用于列表展示）
 */
export interface ExecutionSummary {
  id: string;
  planId: string;
  success: boolean;
  startedAt: string;
  completedAt: string;
}

/**
 * 创建计划选项
 */
export interface CreatePlanOptions {
  enableAutoComplete?: boolean;
  maxRetries?: number;
}

/**
 * 创建计划结果
 */
export interface PlanResult {
  success: boolean;
  plan?: ExecutionPlan;
  error?: string;
}

/**
 * 执行计划选项
 */
export interface ExecuteOptions {
  autoApprove?: boolean;
}

/**
 * 改进计划结果
 */
export interface RefineResult {
  success: boolean;
  plan?: VersionedPlan;
  changes?: PlanChange[];
  error?: string;
}

/**
 * 编排服务接口
 *
 * 提供统一的计划管理、执行、改进 API
 * 可被 CLI 和 Web 表现层复用
 */
export interface OrchestrationService {
  /**
   * 根据用户需求创建执行计划
   */
  createPlan(request: string, options?: CreatePlanOptions): Promise<PlanResult>;

  /**
   * 获取计划详情
   */
  getPlan(planId: string): Promise<ExecutionPlan | undefined>;

  /**
   * 列出所有计划
   */
  listPlans(): Promise<PlanSummary[]>;

  /**
   * 删除计划
   */
  deletePlan(planId: string): Promise<boolean>;

  /**
   * 执行计划
   */
  executePlan(planId: string, options?: ExecuteOptions): Promise<ExecutionResult>;

  /**
   * 获取执行结果
   */
  getExecution(execId: string): Promise<ExecutionResult | undefined>;

  /**
   * 列出执行记录
   */
  listExecutions(): Promise<ExecutionSummary[]>;

  /**
   * 改进计划
   */
  refinePlan(planId: string, instruction: string): Promise<RefineResult>;

  /**
   * 获取计划版本历史
   */
  getPlanHistory(planId: string): Promise<VersionedPlan[]>;

  /**
   * 列出可用函数
   */
  listFunctions(): Promise<FunctionMetadata[]>;

  /**
   * 加载函数
   */
  loadFunctions(path: string): Promise<void>;
}

export const OrchestrationService = Symbol('OrchestrationService');
