/**
 * FunctionProvider 模块
 * 统一的函数发现和执行接口
 */

// 类型定义
export type {
  ProviderType,
  FunctionMetadata,
  FunctionExecutionResult,
} from './types.js';

// 接口和符号
export { FunctionProvider } from './interfaces/FunctionProvider.js';
export { LocalFunctionProviderSymbol as FunctionProviderSymbol } from './symbols.js';

// 远程函数提供者接口
export { MCPClientInterface } from './implementations/MCPClientInterface.js';

// 实现类
export { LocalFunctionProvider } from './LocalFunctionProvider.js';
export { CompositeFunctionProvider } from './CompositeFunctionProvider.js';
export { MCPFunctionProvider } from './implementations/MCPFunctionProvider.js';

// Transport exports
export { MCPClient } from './transports/index.js';
