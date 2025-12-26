/**
 * Tool Provider Symbols
 * 独立定义避免 ESM TDZ 问题
 */

import type { LocalFunctionToolProvider } from './LocalFunctionToolProvider.js';
import type { RemoteToolProvider } from '../mcp/RemoteToolProvider.js';

// 导出 Symbol 用于依赖注入
export const LocalToolProviderSymbol = Symbol('LocalToolProvider') as symbol & { __brand: 'LocalToolProvider' };
export const RemoteToolProviderSymbol = Symbol('RemoteToolProvider') as symbol & { __brand: 'RemoteToolProvider' };

// 导出类型
export type LocalToolProvider = LocalFunctionToolProvider;
export type RemoteToolProviderInstance = RemoteToolProvider;
