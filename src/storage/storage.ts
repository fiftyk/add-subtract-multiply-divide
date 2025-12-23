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

  constructor(dataDir: string = '.data') {
    this.dataDir = dataDir;
    this.plansDir = path.join(dataDir, 'plans');
    this.executionsDir = path.join(dataDir, 'executions');
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.plansDir, { recursive: true });
    await fs.mkdir(this.executionsDir, { recursive: true });
  }

  /**
   * 保存执行计划
   */
  async savePlan(plan: ExecutionPlan): Promise<void> {
    await this.ensureDirectories();
    const filePath = path.join(this.plansDir, `${plan.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8');
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
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
}
