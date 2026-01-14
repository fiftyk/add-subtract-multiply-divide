import 'reflect-metadata';
import { injectable } from 'inversify';
import type { ToolSelector } from './interfaces/ToolSelector.js';
import type { FunctionProvider } from '../function-provider/interfaces/FunctionProvider.js';
import type { FunctionMetadata } from '../function-provider/types.js';

/**
 * 默认工具选择器：返回所有可用函数
 * 这是当前的默认策略，保持向后兼容
 */
@injectable()
export class AllToolsSelector implements ToolSelector {
  /**
   * 选择所有可用函数
   * @param _userRequest - 用户需求（未使用，但保留接口一致性）
   * @param functionProvider - 函数提供者
   * @returns 所有函数列表
   */
  async selectTools(
    _userRequest: string,
    functionProvider: FunctionProvider
  ): Promise<FunctionMetadata[]> {
    return await functionProvider.list();
  }
}
