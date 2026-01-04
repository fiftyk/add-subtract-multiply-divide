import type { ExecutionPlan } from '../../planner/types.js';
import type { ExecutionResult } from '../../executor/types.js';

/**
 * Storage Interface
 * 持久化存储抽象
 *
 * 职责：
 * - 保存/加载执行计划
 * - 保存/加载执行结果
 * - 版本化 plan 支持
 * - Plan-specific mock 管理
 */
export const Storage = Symbol('Storage');

export interface Storage {
  // ========== Plan 管理 ==========

  savePlan(plan: ExecutionPlan): Promise<void>;
  loadPlan(planId: string): Promise<ExecutionPlan | undefined>;
  listPlans(): Promise<ExecutionPlan[]>;
  deletePlan(planId: string): Promise<void>;

  // ========== Plan 版本管理 ==========

  savePlanVersion(plan: ExecutionPlan, basePlanId: string, version: number): Promise<void>;
  loadPlanVersion(basePlanId: string, version: number): Promise<ExecutionPlan | undefined>;
  loadLatestPlanVersion(basePlanId: string): Promise<{ plan: ExecutionPlan; version: number } | undefined>;
  listPlanVersions(basePlanId: string): Promise<number[]>;
  deletePlanAllVersions(basePlanId: string): Promise<void>;

  // ========== Plan Mock 管理 ==========

  getPlanMocksDir(planId: string): string;
  savePlanMock(planId: string, name: string, version: number, code: string): Promise<string>;
  loadPlanMocks(planId: string): Promise<unknown[]>;
  deletePlanWithMocks(planId: string): Promise<void>;

  // ========== Execution 管理 ==========

  saveExecution(result: ExecutionResult): Promise<string>;
  loadExecution(executionId: string): Promise<ExecutionResult | undefined>;
  listExecutions(): Promise<ExecutionResult[]>;
  deleteExecutionsByPlanId(planId: string): Promise<void>;

  // ========== 工具方法 ==========

  parsePlanId(planId: string): { basePlanId: string; version?: number };
}
