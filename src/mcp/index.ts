/**
 * MCP 模块导出
 * 使用官方 @modelcontextprotocol/sdk
 */

// 远程函数注册中心
export type { RemoteFunctionInfo, RemoteFunctionResult } from './interfaces/RemoteFunctionRegistry.js';
export { RemoteFunctionRegistry } from './interfaces/RemoteFunctionRegistry.js';
export { NoOpRemoteFunctionRegistry } from './NoOpRemoteFunctionRegistry.js';

// MCP Client (使用官方 SDK)
export { MCPClient, type MCPClientConfig } from './MCPClient.js';

// Remote Tool Provider
export { RemoteToolProvider } from './RemoteToolProvider.js';
