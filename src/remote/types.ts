/**
 * 函数调用器
 * 封装了远程函数的调用逻辑
 */
export interface FunctionInvoker {
  /** 远程函数 ID */
  id: string;

  /** 远程函数名称 */
  name: string;

  /** 所属注册中心 ID */
  registryId: string;

  /** 调用函数 */
  invoke(params: Record<string, unknown>): Promise<unknown>;
}
