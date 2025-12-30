import { v4 as uuidv4 } from 'uuid';
import type { Planner } from '../planner/interfaces/IPlanner.js';
import type { Storage } from '../storage/index.js';
import type { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import { SessionStorage } from './storage/interfaces/SessionStorage.js';
import type { PlanRefinementLLMClient } from './interfaces/IPlanRefinementLLMClient.js';
import type {
  InteractionSession,
  VersionedPlan,
  SessionMessage,
  CreatePlanOptions,
  CreatePlanResult,
  RefinePlanResult,
} from './types.js';

/**
 * 交互式 Plan 服务
 *
 * 职责：
 * - 管理交互式 plan 生成和改进的完整生命周期
 * - 协调 Planner、Storage、Session 管理
 * - 提供 CLI 和未来 Web 都能使用的统一接口
 *
 * 设计原则：
 * - Service 层独立于 CLI，便于 Web 化
 * - 无状态设计，所有状态通过参数传递
 * - 依赖注入，便于测试
 */
export class InteractivePlanService {
  constructor(
    private planner: Planner,
    private storage: Storage,
    private sessionStorage: SessionStorage,
    private refinementLLMClient: PlanRefinementLLMClient,
    private functionProvider: FunctionProvider
  ) {}

  /**
   * 创建新的 plan（v1）
   *
   * @param userRequest - 用户需求描述
   * @param options - 创建选项
   * @returns 创建结果，包含 plan 和 session
   */
  async createPlan(
    userRequest: string,
    options: CreatePlanOptions = {}
  ): Promise<CreatePlanResult> {
    // 调用基础 planner 生成 plan
    const planResult = await this.planner.plan(userRequest);

    if (!planResult.success || !planResult.plan) {
      throw new Error(
        `Failed to create plan: ${planResult.error || 'Unknown error'}`
      );
    }

    const basePlanId = planResult.plan.id;

    // 保存为 v1
    await this.storage.savePlanVersion(planResult.plan, basePlanId, 1);

    // 创建或获取 session
    let session: InteractionSession;
    if (options.sessionId) {
      const existing = await this.sessionStorage.loadSession(options.sessionId);
      if (existing) {
        session = existing;
      } else {
        session = this.createNewSession(basePlanId, options.sessionId);
      }
    } else {
      session = this.createNewSession(basePlanId);
    }

    // 添加创建消息到 session
    session.messages.push({
      role: 'user',
      content: userRequest,
      timestamp: new Date().toISOString(),
      metadata: {
        action: 'create',
        planVersion: 1,
      },
    });

    session.messages.push({
      role: 'assistant',
      content: `已创建执行计划 ${basePlanId}-v1`,
      timestamp: new Date().toISOString(),
      metadata: {
        action: 'create',
        planVersion: 1,
      },
    });

    session.currentVersion = 1;
    session.updatedAt = new Date().toISOString();

    await this.sessionStorage.saveSession(session);

    const versionedPlan: VersionedPlan = {
      basePlanId,
      version: 1,
      fullId: `${basePlanId}-v1`,
      plan: planResult.plan,
      createdAt: planResult.plan.createdAt,
    };

    return {
      plan: versionedPlan,
      session,
    };
  }

  /**
   * 改进现有 plan
   *
   * @param planId - Plan ID（可以是 plan-xxx 或 plan-xxx-v1）
   * @param refinementInstruction - 用户的修改指令
   * @param sessionId - 可选的 session ID
   * @returns 改进结果，包含新 plan、session 和改动说明
   */
  async refinePlan(
    planId: string,
    refinementInstruction: string,
    sessionId?: string
  ): Promise<RefinePlanResult> {
    // 解析 plan ID
    const { basePlanId, version: inputVersion } = this.storage.parsePlanId(planId);

    // 加载当前 plan
    let currentVersion: number;
    let currentPlan;

    if (inputVersion) {
      currentVersion = inputVersion;
      currentPlan = await this.storage.loadPlanVersion(basePlanId, inputVersion);
    } else {
      // 如果没有指定版本，加载最新版本
      const latest = await this.storage.loadLatestPlanVersion(basePlanId);
      if (!latest) {
        throw new Error(`Plan not found: ${planId}`);
      }
      currentVersion = latest.version;
      currentPlan = latest.plan;
    }

    if (!currentPlan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // 加载或创建 session
    let session: InteractionSession;
    if (sessionId) {
      const existing = await this.sessionStorage.loadSession(sessionId);
      if (!existing) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      session = existing;
    } else {
      // 尝试查找相关的 session
      session = await this.findOrCreateSession(basePlanId);
    }

    // 添加用户消息到 session
    session.messages.push({
      role: 'user',
      content: refinementInstruction,
      timestamp: new Date().toISOString(),
      metadata: {
        action: 'refine',
        planVersion: currentVersion,
      },
    });

    // 调用 LLM 进行改进
    const refinementResult = await this.refinementLLMClient.refinePlan({
      currentPlan,
      refinementInstruction,
      conversationHistory: session.messages,
      availableFunctions: await this.functionProvider.list(),
    });

    // 生成新版本号
    const newVersion = currentVersion + 1;
    const newPlan = refinementResult.refinedPlan;

    // 保存新版本
    await this.storage.savePlanVersion(newPlan, basePlanId, newVersion);

    // 更新 session
    session.messages.push({
      role: 'assistant',
      content: refinementResult.explanation,
      timestamp: new Date().toISOString(),
      metadata: {
        action: 'refine',
        planVersion: newVersion,
      },
    });

    session.currentVersion = newVersion;
    session.updatedAt = new Date().toISOString();

    await this.sessionStorage.saveSession(session);

    const versionedPlan: VersionedPlan = {
      basePlanId,
      version: newVersion,
      fullId: `${basePlanId}-v${newVersion}`,
      plan: newPlan,
      parentVersion: currentVersion,
      refinementInstruction,
      createdAt: new Date().toISOString(),
    };

    return {
      newPlan: versionedPlan,
      session,
      changes: refinementResult.changes,
    };
  }

  /**
   * 获取 plan 的所有版本历史
   *
   * @param basePlanId - 基础 plan ID
   * @returns 所有版本的 plan，按版本号升序
   */
  async getPlanHistory(basePlanId: string): Promise<VersionedPlan[]> {
    const versions = await this.storage.listPlanVersions(basePlanId);
    const plans: VersionedPlan[] = [];

    for (const version of versions) {
      const plan = await this.storage.loadPlanVersion(basePlanId, version);
      if (plan) {
        plans.push({
          basePlanId,
          version,
          fullId: `${basePlanId}-v${version}`,
          plan,
          createdAt: plan.createdAt,
        });
      }
    }

    return plans;
  }

  /**
   * 获取会话详情
   *
   * @param sessionId - Session ID
   * @returns Session 对象
   */
  async getSession(sessionId: string): Promise<InteractionSession | null> {
    return this.sessionStorage.loadSession(sessionId);
  }

  /**
   * 创建新的 session
   */
  private createNewSession(
    planId: string,
    sessionId?: string
  ): InteractionSession {
    return {
      sessionId: sessionId || `session-${uuidv4().slice(0, 8)}`,
      planId,
      currentVersion: 0,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };
  }

  /**
   * 查找或创建 session
   */
  private async findOrCreateSession(
    planId: string
  ): Promise<InteractionSession> {
    // 查找与此 plan 相关的活跃 session
    const sessions = await this.sessionStorage.listSessions();
    const activeSession = sessions.find(
      (s) => s.planId === planId && s.status === 'active'
    );

    if (activeSession) {
      return activeSession;
    }

    // 创建新 session
    return this.createNewSession(planId);
  }
}
