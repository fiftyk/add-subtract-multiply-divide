/**
 * Function Service Interface
 * 统一的函数管理服务接口，供 CLI 和 Web 端共用
 */

import type { FunctionMetadata } from '../../function-provider/types.js';

export interface FunctionServiceOptions {
  /** 本地函数文件或目录路径 */
  functionsPath?: string;
  /** 是否自动连接 MCP servers（默认：true） */
  autoConnect?: boolean;
}

export interface CategorizedFunctions {
  /** 本地函数列表 */
  local: FunctionMetadata[];
  /** 远程函数列表 */
  remote: FunctionMetadata[];
}

/**
 * Function Service
 *
 * 职责：
 * - 统一管理本地和远程函数的加载和列举
 * - 封装 FunctionProvider 的初始化流程
 * - 提供便捷的查询方法
 *
 * 使用场景：
 * - CLI 命令：list functions, plan, execute
 * - Web API：/api/functions
 */
export interface FunctionService {
  /**
   * 初始化服务
   * - 连接 MCP servers（如果启用）
   * - 加载本地函数（如果提供路径）
   */
  initialize(options?: FunctionServiceOptions): Promise<void>;

  /**
   * 列举所有函数（本地 + 远程）
   */
  listFunctions(): Promise<FunctionMetadata[]>;

  /**
   * 加载本地函数文件
   * @param functionsPath - 函数文件或目录路径
   */
  loadLocalFunctions(functionsPath: string): Promise<void>;

  /**
   * 获取分类后的函数列表
   */
  getCategorizedFunctions(): Promise<CategorizedFunctions>;

  /**
   * 检查服务是否已初始化
   */
  isInitialized(): boolean;
}

export const FunctionService = Symbol('FunctionService');
