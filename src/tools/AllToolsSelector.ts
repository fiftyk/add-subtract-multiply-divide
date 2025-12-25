import 'reflect-metadata';
import { injectable } from 'inversify';
import type { ToolSelector } from './interfaces/ToolSelector.js';
import type { ToolProvider } from './interfaces/ToolProvider.js';
import type { ToolDefinition } from './types.js';

/**
 * 默认工具选择器：返回所有可用工具
 * 这是当前的默认策略，保持向后兼容
 */
@injectable()
export class AllToolsSelector implements ToolSelector {
  /**
   * 选择所有可用工具
   * @param _userRequest - 用户需求（未使用，但保留接口一致性）
   * @param toolProvider - 工具提供者
   * @returns 所有工具列表
   */
  async selectTools(
    _userRequest: string,
    toolProvider: ToolProvider
  ): Promise<ToolDefinition[]> {
    return await toolProvider.searchTools();
  }
}
