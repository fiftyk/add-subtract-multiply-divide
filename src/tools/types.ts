import type { FunctionDefinition } from '../registry/types.js';

/**
 * 工具定义
 * 统一本地函数和远程函数的元数据格式
 */
export interface ToolDefinition extends Omit<FunctionDefinition, 'implementation'> {
  /** 工具唯一标识 */
  id: string;

  /** 工具类型 */
  type: 'local' | 'remote';

  /** 所属注册中心 ID（远程函数特有） */
  registryId?: string;
}
