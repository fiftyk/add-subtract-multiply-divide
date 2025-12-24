import 'reflect-metadata';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { injectable } from 'inversify';
import type { ExecutionPlan } from '../planner/types.js';
import type { ExecutionResult } from '../executor/types.js';
import type { Storage } from './interfaces/Storage.js';

/**
 * 持久化存储
 * Implements Storage interface for dependency injection
 */
@injectable()
export class StorageImpl implements Storage {
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

  // ============================================================================
  // Plan Mock 函数管理（新架构）
  // ============================================================================

  /**
   * 获取 Plan 的 mocks 目录路径
   * 新架构：.data/plans/{planId}/mocks/
   *
   * @param planId - Plan ID（可能包含版本号，如 plan-abc123-v2）
   * @returns Mocks 目录的绝对路径
   */
  getPlanMocksDir(planId: string): string {
    // 提取基础 ID（移除版本号）
    const { basePlanId } = this.parsePlanId(planId);
    return path.join(this.plansDir, basePlanId, 'mocks');
  }

  /**
   * 保存 mock 函数到 Plan 的 mocks 目录
   * 文件名格式：{functionName}-v{version}.js
   *
   * @param planId - Plan ID
   * @param name - 函数名
   * @param version - Mock 版本号
   * @param code - 函数代码（完整的 JS/TS 代码）
   * @returns 保存的文件路径（相对于 plan 目录，如 "mocks/power-v1.js"）
   */
  async savePlanMock(
    planId: string,
    name: string,
    version: number,
    code: string
  ): Promise<string> {
    const mocksDir = this.getPlanMocksDir(planId);

    // 确保 mocks 目录存在
    await fs.mkdir(mocksDir, { recursive: true });

    // 生成文件名
    const fileName = `${name}-v${version}.js`;
    const filePath = path.join(mocksDir, fileName);

    // 保存文件
    await this.atomicWrite(filePath, code);

    // 返回相对路径（相对于 plan 目录）
    return `mocks/${fileName}`;
  }

  /**
   * 加载 Plan 的所有 mock 函数
   * 动态 import 所有 .js 文件并提取 FunctionDefinition
   *
   * @param planId - Plan ID
   * @returns Mock 函数定义数组
   */
  async loadPlanMocks(planId: string): Promise<unknown[]> {
    const mocksDir = this.getPlanMocksDir(planId);

    try {
      // 检查目录是否存在
      await fs.access(mocksDir);
    } catch {
      // 目录不存在，返回空数组
      return [];
    }

    try {
      const files = await fs.readdir(mocksDir);
      const mockFiles = files.filter((file) => file.endsWith('.js'));

      const functions: unknown[] = [];

      for (const file of mockFiles) {
        const filePath = path.join(mocksDir, file);

        try {
          // 动态 import（使用 file:// URL 和缓存破坏）
          const { pathToFileURL } = await import('url');
          const fileUrl = pathToFileURL(filePath).href;
          const moduleUrl = `${fileUrl}?t=${Date.now()}`;
          const module = await import(moduleUrl);

          // 提取所有导出的函数定义
          for (const key of Object.keys(module)) {
            const exported = module[key];
            if (
              exported &&
              typeof exported === 'object' &&
              'name' in exported &&
              'implementation' in exported
            ) {
              functions.push(exported);
            }
          }
        } catch (error) {
          // 记录加载失败的文件，但继续加载其他文件
          console.warn(`Failed to load mock from ${filePath}:`, error);
        }
      }

      return functions;
    } catch {
      return [];
    }
  }

  /**
   * 删除 Plan 及其所有 mock 函数
   * 删除版本化的 plan 文件和 mocks 目录
   *
   * @param planId - Plan ID
   */
  async deletePlanWithMocks(planId: string): Promise<void> {
    const { basePlanId } = this.parsePlanId(planId);

    // 1. 删除所有版本的 plan 文件
    await this.deletePlanAllVersions(basePlanId);

    // 2. 删除 mocks 目录
    const mocksDir = this.getPlanMocksDir(planId);
    try {
      await fs.rm(mocksDir, { recursive: true, force: true });
    } catch {
      // 忽略删除失败（可能目录不存在）
    }

    // 3. 如果 plan 目录为空，删除 plan 目录
    const planDir = path.join(this.plansDir, basePlanId);
    try {
      const files = await fs.readdir(planDir);
      if (files.length === 0) {
        await fs.rmdir(planDir);
      }
    } catch {
      // 忽略错误
    }
  }
}
