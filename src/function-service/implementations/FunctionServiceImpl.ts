/**
 * Function Service Implementation
 * 统一的函数管理服务实现
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import * as path from 'path';
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import type {
  FunctionService,
  FunctionServiceOptions,
  CategorizedFunctions,
} from '../interfaces/FunctionService.js';
import type { FunctionMetadata } from '../../function-provider/types.js';
import type { FunctionDefinition } from '../../registry/types.js';
import { FunctionProvider } from '../../function-provider/interfaces/FunctionProvider.js';

/**
 * Function Service Implementation
 *
 * 职责：
 * - 封装 FunctionProvider 的初始化和使用
 * - 提供统一的函数加载和列举接口
 * - 处理本地函数文件的动态导入
 */
@injectable()
export class FunctionServiceImpl implements FunctionService {
  private _initialized: boolean = false;

  constructor(
    @inject(FunctionProvider) private functionProvider: FunctionProvider
  ) {}

  async initialize(options?: FunctionServiceOptions): Promise<void> {
    const { functionsPath, autoConnect = true } = options || {};

    // 1. 连接 MCP servers（如果启用）
    if (autoConnect && typeof this.functionProvider.initialize === 'function') {
      await this.functionProvider.initialize();
    }

    // 2. 加载本地函数（如果提供路径）
    if (functionsPath) {
      await this.loadLocalFunctions(functionsPath);
    }

    this._initialized = true;
  }

  async listFunctions(): Promise<FunctionMetadata[]> {
    return this.functionProvider.list();
  }

  async loadLocalFunctions(functionsPath: string): Promise<void> {
    // 转换为绝对路径
    const absolutePath = path.isAbsolute(functionsPath)
      ? functionsPath
      : path.resolve(process.cwd(), functionsPath);

    // 检查路径是否存在
    try {
      await fs.access(absolutePath);
    } catch {
      // 路径不存在，静默返回
      return;
    }

    // 检查是文件还是目录
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      await this.loadFunctionsFromDirectory(absolutePath);
    } else {
      await this.loadFunctionsFromFile(absolutePath);
    }
  }

  async getCategorizedFunctions(): Promise<CategorizedFunctions> {
    const allFunctions = await this.listFunctions();

    return {
      local: allFunctions.filter((f) => f.type === 'local'),
      remote: allFunctions.filter((f) => f.type === 'remote'),
    };
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * 从单个文件加载函数
   */
  private async loadFunctionsFromFile(filePath: string): Promise<void> {
    try {
      const module = await import(filePath);

      // 注册所有导出的函数
      for (const key of Object.keys(module)) {
        const fn = module[key];
        if (this.isFunctionDefinition(fn)) {
          if (typeof this.functionProvider.register === 'function') {
            this.functionProvider.register(fn);
          }
        }
      }
    } catch (error) {
      // 静默处理加载失败
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') ||
          error.message.includes('ENOENT'))
      ) {
        return;
      }
      throw error;
    }
  }

  /**
   * 从目录加载所有 .js 文件中的函数
   */
  private async loadFunctionsFromDirectory(dirPath: string): Promise<void> {
    try {
      // 读取目录内容
      const files = await fs.readdir(dirPath);

      // 过滤出 .js 文件
      const jsFiles = files.filter((file) => file.endsWith('.js'));

      // 加载每个文件
      for (const file of jsFiles) {
        const filePath = path.join(dirPath, file);
        try {
          // 使用 pathToFileURL 和 cache busting 进行动态导入
          const fileUrl = pathToFileURL(filePath).href;
          const moduleUrl = `${fileUrl}?t=${Date.now()}`;
          const module = await import(moduleUrl);

          // 注册所有导出的函数
          for (const key of Object.keys(module)) {
            const fn = module[key];
            if (this.isFunctionDefinition(fn)) {
              // 检查是否已存在，避免重复注册错误
              if (typeof this.functionProvider.register === 'function') {
                const exists = await this.functionProvider.has(fn.name);
                if (!exists) {
                  this.functionProvider.register(fn);
                }
              }
            }
          }
        } catch (error) {
          // 单个文件加载失败时继续处理其他文件
          console.warn(`Warning: Failed to load ${file}:`, error);
        }
      }
    } catch (error) {
      // 目录读取失败，静默处理
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return;
      }
      throw error;
    }
  }

  /**
   * 检查是否是有效的函数定义
   */
  private isFunctionDefinition(obj: unknown): obj is FunctionDefinition {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const fn = obj as Record<string, unknown>;
    return (
      typeof fn.name === 'string' &&
      typeof fn.description === 'string' &&
      typeof fn.scenario === 'string' &&
      Array.isArray(fn.parameters) &&
      typeof fn.returns === 'object' &&
      typeof fn.implementation === 'function'
    );
  }
}
