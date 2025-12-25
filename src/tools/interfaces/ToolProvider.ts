import type { ToolDefinition } from '../types.js';

export const ToolProvider = Symbol('ToolProvider');

/**
 * 工具提供者接口
 * 提供工具的发现、查询能力
 */
export interface ToolProvider {
  /**
   * 查询所有可用工具
   */
  searchTools(): ToolDefinition[];
}
