/**
 * LocalFunctionProvider 符号定义
 */

export const LocalFunctionProviderSymbol = Symbol('LocalFunctionProvider');

/**
 * MCP 远程函数提供者符号定义（单个，兼容性保留）
 */
export const RemoteFunctionProviderSymbol = Symbol('RemoteFunctionProvider');

/**
 * 所有 MCP 远程函数提供者符号定义（数组，用于多服务器支持）
 */
export const AllRemoteFunctionProvidersSymbol = Symbol('AllRemoteFunctionProviders');
