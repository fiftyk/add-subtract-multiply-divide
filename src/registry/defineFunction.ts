import type { FunctionDefinition, FunctionDefinitionInput } from './types.js';

/**
 * 定义函数的辅助函数
 *
 * @example
 * ```typescript
 * import { defineFunction } from '../src/registry/index.js';
 *
 * export const add = defineFunction({
 *   name: 'add',
 *   description: '两个数相加',
 *   scenario: '需要进行加法计算时使用',
 *   parameters: [
 *     { name: 'a', type: 'number', description: '第一个加数' },
 *     { name: 'b', type: 'number', description: '第二个加数' }
 *   ],
 *   returns: { type: 'number', description: '两数之和' },
 *   implementation: (a, b) => a + b
 * });
 * ```
 */
export function defineFunction(input: FunctionDefinitionInput): FunctionDefinition {
  return {
    name: input.name,
    description: input.description,
    scenario: input.scenario,
    parameters: input.parameters,
    returns: input.returns,
    implementation: input.implementation,
  };
}
