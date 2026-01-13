/**
 * Sessions Command - 管理执行会话
 *
 * 提供会话列表、查看、重试、删除和统计功能
 */

import container from '../../container/cli-container.js';
import { A2UIService } from '../../a2ui/A2UIService.js';
import {
  ExecutionSessionStorage,
  ExecutionSessionManager,
  type ExecutionSession,
  type ExecutionStats,
  type ListSessionsOptions,
} from '../../executor/session/index.js';
import type { ExecutionStatus } from '../../a2ui/types.js';
import { Executor } from '../../executor/index.js';
import { Planner } from '../../planner/index.js';

/**
 * List sessions command
 */
export async function listCommand(options: {
  plan?: string;
  status?: string;
}): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);

  try {
    ui.startSurface('sessions-list');
    ui.heading('📋 执行会话列表');

    const sessionStorage = container.get<ExecutionSessionStorage>(ExecutionSessionStorage);

    const queryOptions: ListSessionsOptions = {};
    if (options.plan) {
      // 可以是完整 ID 或 base ID
      queryOptions.planId = options.plan;
    }
    if (options.status) {
      queryOptions.status = options.status as ExecutionStatus;
    }

    const sessions = await sessionStorage.listSessions(queryOptions);

    if (sessions.length === 0) {
      ui.caption('没有找到匹配的会话');
      ui.endSurface();
      process.exit(0);
    }

    ui.caption(`找到 ${sessions.length} 个会话:\n`);

    // 按 plan 分组显示
    const groupedByPlan = sessions.reduce((acc, session) => {
      const key = session.basePlanId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(session);
      return acc;
    }, {} as Record<string, ExecutionSession[]>);

    for (const [basePlanId, planSessions] of Object.entries(groupedByPlan)) {
      ui.text(`Plan: ${basePlanId}`, 'subheading');

      for (const session of planSessions) {
        const statusBadge = getStatusBadge(session.status);
        const duration = session.completedAt
          ? formatDuration(
              new Date(session.createdAt).getTime(),
              new Date(session.completedAt).getTime()
            )
          : 'running';

        ui.caption(
          `  ${statusBadge} ${session.id} - ${session.planId} (${duration}) [${session.platform}]`
        );
      }
      ui.text(''); // 空行
    }

    ui.endSurface();
    process.exit(0);
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}

/**
 * Show session details command
 */
export async function showCommand(sessionId: string): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);

  try {
    ui.startSurface('sessions-show');
    ui.heading(`📄 会话详情: ${sessionId}`);

    const sessionStorage = container.get<ExecutionSessionStorage>(ExecutionSessionStorage);
    const session = await sessionStorage.loadSession(sessionId);

    if (!session) {
      ui.badge(`❌ 找不到会话: ${sessionId}`, 'error');
      ui.endSurface();
      process.exit(1);
    }

    // 基本信息
    ui.text('基本信息:', 'subheading');
    ui.caption(`  Session ID: ${session.id}`);
    ui.caption(`  Plan ID: ${session.planId}`);
    ui.caption(`  Base Plan ID: ${session.basePlanId}`);
    if (session.planVersion) {
      ui.caption(`  Plan Version: v${session.planVersion}`);
    }
    ui.caption(`  Platform: ${session.platform}`);
    ui.caption(`  Status: ${getStatusBadge(session.status)}`);
    ui.caption(`  创建时间: ${formatTimestamp(session.createdAt)}`);
    if (session.completedAt) {
      ui.caption(`  完成时间: ${formatTimestamp(session.completedAt)}`);
      const duration = formatDuration(
        new Date(session.createdAt).getTime(),
        new Date(session.completedAt).getTime()
      );
      ui.caption(`  执行时长: ${duration}`);
    }

    // 重试信息
    if (session.parentSessionId) {
      ui.text(''); // 空行
      ui.text('重试信息:', 'subheading');
      ui.caption(`  父会话 ID: ${session.parentSessionId}`);
      ui.caption(`  重试次数: ${session.retryCount}`);
    }

    // 计划详情
    ui.text(''); // 空行
    ui.text('执行计划:', 'subheading');
    const planner = container.get<Planner>(Planner);
    ui.text(planner.formatPlanForDisplay(session.plan));

    // 执行结果
    if (session.result) {
      ui.text(''); // 空行
      ui.text('执行结果:', 'subheading');
      const executor = container.get<Executor>(Executor);
      ui.text(executor.formatResultForDisplay(session.result));
    }

    // 失败提示
    if (session.status === 'failed') {
      ui.text(''); // 空行
      ui.text(`💡 提示: 使用 "npx fn-orchestrator sessions retry ${session.id}" 重试`, 'subheading');
    }

    ui.endSurface();
    process.exit(0);
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}

/**
 * Retry session command
 */
export async function retryCommand(
  sessionId: string,
  options: { fromStep?: number }
): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);

  try {
    ui.startSurface('sessions-retry');
    ui.heading(`🔄 重试会话: ${sessionId}`);

    const sessionManager = container.get<ExecutionSessionManager>(ExecutionSessionManager);

    // 创建重试会话
    const retrySession = await sessionManager.retrySession(
      sessionId,
      options.fromStep
    );

    ui.badge('✅ 重试会话已创建', 'success');
    ui.caption(`新会话 ID: ${retrySession.id}`);
    if (options.fromStep !== undefined) {
      ui.caption(`从步骤 ${options.fromStep} 开始`);
    }
    ui.text(''); // 空行

    // 执行重试会话
    ui.heading('🚀 开始执行...');
    const result = await sessionManager.executeSession(retrySession.id);

    // 显示结果
    const executor = container.get<Executor>(Executor);
    ui.text(executor.formatResultForDisplay(result));

    if (result.success) {
      ui.badge('✅ 执行成功!', 'success');
      ui.caption(`Session ID: ${retrySession.id}`);
      ui.endSurface();
      process.exit(0);
    } else {
      ui.badge('❌ 执行失败', 'error');
      ui.caption(`Session ID: ${retrySession.id}`);
      ui.text(`💡 提示: 使用 "npx fn-orchestrator sessions retry ${retrySession.id}" 再次重试`, 'subheading');
      ui.endSurface();
      process.exit(1);
    }
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}

/**
 * Delete session command
 */
export async function deleteCommand(sessionId: string): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);

  try {
    ui.startSurface('sessions-delete');
    ui.heading(`🗑️  删除会话: ${sessionId}`);

    const sessionStorage = container.get<ExecutionSessionStorage>(ExecutionSessionStorage);

    // 验证会话存在
    const session = await sessionStorage.loadSession(sessionId);
    if (!session) {
      ui.badge(`❌ 找不到会话: ${sessionId}`, 'error');
      ui.endSurface();
      process.exit(1);
    }

    // 删除会话
    await sessionStorage.deleteSession(sessionId);

    ui.badge('✅ 会话已删除', 'success');
    ui.endSurface();
    process.exit(0);
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}

/**
 * Show execution statistics command
 */
export async function statsCommand(planId: string): Promise<void> {
  const ui = container.get<A2UIService>(A2UIService);

  try {
    ui.startSurface('sessions-stats');
    ui.heading(`📊 执行统计: ${planId}`);

    const sessionStorage = container.get<ExecutionSessionStorage>(ExecutionSessionStorage);
    const stats = await sessionStorage.getExecutionStats(planId);

    if (stats.totalExecutions === 0) {
      ui.caption('该计划还没有执行记录');
      ui.endSurface();
      process.exit(0);
    }

    ui.text('统计信息:', 'subheading');
    ui.caption(`  总执行次数: ${stats.totalExecutions}`);
    ui.caption(`  成功次数: ${stats.successCount}`);
    ui.caption(`  失败次数: ${stats.failureCount}`);

    const successRate =
      stats.totalExecutions > 0
        ? ((stats.successCount / stats.totalExecutions) * 100).toFixed(1)
        : '0';
    ui.caption(`  成功率: ${successRate}%`);

    if (stats.averageDuration > 0) {
      ui.caption(`  平均执行时长: ${formatDuration(0, stats.averageDuration)}`);
    }

    ui.endSurface();
    process.exit(0);
  } catch (error) {
    ui.badge(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    ui.endSurface();
    process.exit(1);
  }
}

// ============================================
// Helper Functions
// ============================================

function getStatusBadge(status: ExecutionStatus): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    case 'waiting_input':
      return '⏸️';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '❓';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const durationMs = endMs - startMs;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
