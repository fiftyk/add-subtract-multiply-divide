/**
 * Composite Tool Provider
 * 合并本地函数和远程 MCP 工具，提供统一的工具访问接口
 */

import 'reflect-metadata';
import { injectable, inject, unmanaged } from 'inversify';
import { ToolProvider } from './interfaces/ToolProvider.js';
import type { FunctionMetadata } from '../function-provider/types.js';
import { LoggerFactory, type ILogger } from '../logger/index.js';
import { LocalFunctionToolProvider } from './LocalFunctionToolProvider.js';
import { RemoteToolProvider } from '../mcp/RemoteToolProvider.js';
import { LocalToolProviderSymbol, RemoteToolProviderSymbol } from './providerSymbols.js';

/**
 * 组合工具提供者
 * 从多个 ToolProvider 合并工具列表
 */
@injectable()
export class CompositeToolProvider implements ToolProvider {
  private readonly logger: ILogger;

  constructor(
    @inject(LocalToolProviderSymbol) private localToolProvider: LocalFunctionToolProvider,
    @inject(RemoteToolProviderSymbol) private remoteToolProvider: RemoteToolProvider,
    @unmanaged() logger?: ILogger
  ) {
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * 搜索所有可用工具（本地 + 远程）
   * 远程工具会标记 type 为 'remote'
   */
  async searchTools(): Promise<FunctionMetadata[]> {
    const [localTools, remoteTools] = await Promise.all([
      this.localToolProvider.searchTools(),
      this.remoteToolProvider.searchTools(),
    ]);

    // 合并工具列表，远程工具放在后面
    const allTools = [...localTools, ...remoteTools];

    this.logger.debug(`CompositeToolProvider: found ${localTools.length} local + ${remoteTools.length} remote tools`);

    return allTools;
  }

  /**
   * 检查工具是否存在（检查本地和远程）
   */
  async hasTool(id: string): Promise<boolean> {
    // 先检查本地
    if (await this.localToolProvider.hasTool(id)) {
      return true;
    }
    // 再检查远程
    return await this.remoteToolProvider.hasTool(id);
  }
}
