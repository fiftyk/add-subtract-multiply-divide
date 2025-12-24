import type { ExecutionPlan } from '../planner/types.js';
import type { FunctionDefinition } from '../registry/types.js';

/**
 * 会话消息
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    planVersion?: number;      // 关联的 plan 版本
    action?: 'create' | 'refine' | 'question';
  };
}

/**
 * 交互会话
 * 用于跟踪用户与系统的完整对话历史
 */
export interface InteractionSession {
  sessionId: string;           // session-{uuid}
  planId: string;              // 关联的 plan 基础 ID (不含版本号)
  currentVersion: number;      // 当前版本号
  messages: SessionMessage[];  // 对话历史
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed';
}

/**
 * 版本化的执行计划
 */
export interface VersionedPlan {
  basePlanId: string;          // plan-{uuid} (基础 ID，不含版本号)
  version: number;             // 版本号: 1, 2, 3...
  fullId: string;              // plan-{uuid}-v{version}
  plan: ExecutionPlan;         // 实际的执行计划
  parentVersion?: number;      // 父版本号（如果是改进版本）
  refinementInstruction?: string;  // 导致此版本的修改指令
  createdAt: string;
}

/**
 * Plan 改动类型
 */
export type PlanChangeType =
  | 'step_modified'    // 修改步骤
  | 'step_added'       // 添加步骤
  | 'step_removed'     // 删除步骤
  | 'step_reordered';  // 重新排序

/**
 * Plan 改动详情
 */
export interface PlanChange {
  type: PlanChangeType;
  stepId?: number;
  description: string;
  before?: any;
  after?: any;
}

/**
 * Plan 改进请求
 */
export interface PlanRefinementRequest {
  currentPlan: ExecutionPlan;
  refinementInstruction: string;  // 用户的修改指令
  conversationHistory: SessionMessage[];  // 对话历史上下文
  availableFunctions: FunctionDefinition[];  // 可用函数列表
}

/**
 * Plan 改进响应
 */
export interface PlanRefinementResponse {
  refinedPlan: ExecutionPlan;
  changes: PlanChange[];         // 改动说明
  explanation: string;           // LLM 对改动的解释
}

/**
 * 创建 Plan 的选项
 */
export interface CreatePlanOptions {
  sessionId?: string;        // 可选：使用现有 session
  enablePreQuestions?: boolean;  // 是否启用 plan 前询问
  autoMock?: boolean;        // 是否启用自动 mock 生成
}

/**
 * 创建 Plan 的结果
 */
export interface CreatePlanResult {
  plan: VersionedPlan;
  session: InteractionSession;
  questions?: Question[];      // 如果需要询问用户
}

/**
 * 改进 Plan 的结果
 */
export interface RefinePlanResult {
  newPlan: VersionedPlan;
  session: InteractionSession;
  changes: PlanChange[];
}

/**
 * 询问问题
 */
export interface Question {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'text_input';
  question: string;
  options?: string[];
  metadata?: {
    reason: string;        // 为什么要问这个问题
    relatedFunction?: string;
  };
}
