import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ExecutionPlan } from '../planner/types.js';
import type { ExecutionResult } from '../executor/types.js';

/**
 * 持久化存储
 */
export class Storage {
  private dataDir: string;
  private plansDir: string;
  private executionsDir: string;
  private initialized: Promise<void> | null = null;

  constructor(dataDir: string = '.data') {
    this.dataDir = dataDir;
    this.plansDir = path.join(dataDir, 'plans');
    this.executionsDir = path.join(dataDir, 'executions');
  }

  /**
   * 确保目录存在（仅初始化一次，避免竞态条件）
   */
  private async ensureDirectories(): Promise<void> {
    if (this.initialized === null) {
      this.initialized = (async () => {
        await fs.mkdir(this.plansDir, { recursive: true });
        await fs.mkdir(this.executionsDir, { recursive: true });
      })();
    }
    return this.initialized;
  }

  /**
   * 原子写入文件（使用临时文件 + rename）
   */
  private async atomicWrite(
    filePath: string,
    content: string
  ): Promise<void> {
    const tmpPath = `${filePath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tmpPath, content, 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tmpPath);
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 保存执行计划
   */
  async savePlan(plan: ExecutionPlan): Promise<void> {
    await this.ensureDirectories();
    const filePath = path.join(this.plansDir, `${plan.id}.json`);
    await this.atomicWrite(filePath, JSON.stringify(plan, null, 2));
  }

  /**
   * 加载执行计划
   */
  async loadPlan(planId: string): Promise<ExecutionPlan | undefined> {
    try {
      const filePath = path.join(this.plansDir, `${planId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as ExecutionPlan;
    } catch {
      return undefined;
    }
  }

  /**
   * 列出所有计划
   */
  async listPlans(): Promise<ExecutionPlan[]> {
    await this.ensureDirectories();
    try {
      const files = await fs.readdir(this.plansDir);
      const plans: ExecutionPlan[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const planId = file.replace('.json', '');
          const plan = await this.loadPlan(planId);
          if (plan) {
            plans.push(plan);
          }
        }
      }

      return plans;
    } catch {
      return [];
    }
  }

  /**
   * 删除计划
   */
  async deletePlan(planId: string): Promise<void> {
    try {
      const filePath = path.join(this.plansDir, `${planId}.json`);
      await fs.unlink(filePath);
    } catch {
      // 忽略不存在的文件
    }
  }

  /**
   * 保存执行结果
   */
  async saveExecution(result: ExecutionResult): Promise<string> {
    await this.ensureDirectories();
    const id = `exec-${uuidv4().slice(0, 8)}`;
    const filePath = path.join(this.executionsDir, `${id}.json`);
    const data = { id, ...result };
    await this.atomicWrite(filePath, JSON.stringify(data, null, 2));
    return id;
  }

  /**
   * 加载执行结果
   */
  async loadExecution(executionId: string): Promise<ExecutionResult | undefined> {
    try {
      const filePath = path.join(this.executionsDir, `${executionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as ExecutionResult;
    } catch {
      return undefined;
    }
  }

  /**
   * 列出所有执行结果
   */
  async listExecutions(): Promise<ExecutionResult[]> {
    await this.ensureDirectories();
    try {
      const files = await fs.readdir(this.executionsDir);
      const results: ExecutionResult[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const result = await this.loadExecution(id);
          if (result) {
            results.push(result);
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  // ============================================================================
  // 版本化 Plan 支持（用于交互式改进功能）
  // ============================================================================

  /**
   * 保存版本化的 plan
   * 文件名格式：plan-{basePlanId}-v{version}.json
   *
   * @param plan - 执行计划
   * @param basePlanId - 基础 plan ID（不含版本号）
   * @param version - 版本号
   */
  async savePlanVersion(
    plan: ExecutionPlan,
    basePlanId: string,
    version: number
  ): Promise<void> {
    await this.ensureDirectories();
    const versionedId = `${basePlanId}-v${version}`;
    const filePath = path.join(this.plansDir, `${versionedId}.json`);
    await this.atomicWrite(filePath, JSON.stringify(plan, null, 2));
  }

  /**
   * 加载特定版本的 plan
   *
   * @param basePlanId - 基础 plan ID
   * @param version - 版本号
   * @returns 指定版本的 plan，如果不存在返回 undefined
   */
  async loadPlanVersion(
    basePlanId: string,
    version: number
  ): Promise<ExecutionPlan | undefined> {
    const versionedId = `${basePlanId}-v${version}`;
    return this.loadPlan(versionedId);
  }

  /**
   * 加载最新版本的 plan
   *
   * @param basePlanId - 基础 plan ID
   * @returns 最新版本的 plan，如果不存在返回 undefined
   */
  async loadLatestPlanVersion(
    basePlanId: string
  ): Promise<{ plan: ExecutionPlan; version: number } | undefined> {
    const versions = await this.listPlanVersions(basePlanId);
    if (versions.length === 0) {
      return undefined;
    }

    // 版本号最大的就是最新版本
    const latestVersion = Math.max(...versions);
    const plan = await this.loadPlanVersion(basePlanId, latestVersion);

    if (!plan) {
      return undefined;
    }

    return { plan, version: latestVersion };
  }

  /**
   * 列出某个 plan 的所有版本号
   *
   * @param basePlanId - 基础 plan ID
   * @returns 版本号数组，按升序排列
   */
  async listPlanVersions(basePlanId: string): Promise<number[]> {
    await this.ensureDirectories();
    try {
      const files = await fs.readdir(this.plansDir);
      const versions: number[] = [];

      // 匹配格式：plan-{basePlanId}-v{version}.json
      const prefix = `${basePlanId}-v`;
      for (const file of files) {
        if (file.startsWith(prefix) && file.endsWith('.json')) {
          const versionPart = file.slice(prefix.length, -5); // 移除 '.json'
          const version = parseInt(versionPart, 10);
          if (!isNaN(version)) {
            versions.push(version);
          }
        }
      }

      // 升序排列
      return versions.sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * 解析 plan ID，提取基础 ID 和版本号
   * 支持格式：
   * - plan-abc123 -> { basePlanId: 'plan-abc123', version: undefined }
   * - plan-abc123-v2 -> { basePlanId: 'plan-abc123', version: 2 }
   *
   * @param planId - Plan ID（可能包含或不包含版本号）
   * @returns 基础 ID 和版本号
   */
  parsePlanId(planId: string): { basePlanId: string; version?: number } {
    const match = planId.match(/^(.+)-v(\d+)$/);
    if (match) {
      return {
        basePlanId: match[1],
        version: parseInt(match[2], 10),
      };
    }
    return { basePlanId: planId };
  }

  /**
   * 删除某个 plan 的所有版本
   *
   * @param basePlanId - 基础 plan ID
   */
  async deletePlanAllVersions(basePlanId: string): Promise<void> {
    const versions = await this.listPlanVersions(basePlanId);
    for (const version of versions) {
      const versionedId = `${basePlanId}-v${version}`;
      await this.deletePlan(versionedId);
    }
  }
}
