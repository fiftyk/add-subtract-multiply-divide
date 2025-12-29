import type { FunctionMetadata } from '../../function-provider/types.js';

export const ToolProvider = Symbol('ToolProvider');

/**
 * 工具提供者接口
 * 提供工具的发现、查询、验证能力
 */
export interface ToolProvider {
  /**
   * 查询所有可用工具
   * 异步设计以支持远程工具提供者（网络请求、数据库查询等）
   */
  searchTools(): Promise<FunctionMetadata[]>;

  /**
   * 验证工具是否存在
   * 异步设计以支持远程工具提供者
   * @param id - 工具唯一标识
   */
  hasTool(id: string): Promise<boolean>;
}
