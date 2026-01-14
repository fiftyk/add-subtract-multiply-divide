import { defineFunction } from '@fn-orchestrator/core/registry';

/**
 * 加法函数
 */
export const add = defineFunction({
  name: 'add',
  description: '将两个数字相加',
  scenario: '当需要计算两个数的和时使用，例如"计算 3 + 5"',
  parameters: [
    { name: 'a', type: 'number', description: '第一个加数' },
    { name: 'b', type: 'number', description: '第二个加数' },
  ],
  returns: { type: 'number', description: '两数之和' },
  implementation: (a: number, b: number) => a + b,
});

/**
 * 减法函数
 */
export const subtract = defineFunction({
  name: 'subtract',
  description: '将两个数字相减',
  scenario: '当需要计算两个数的差时使用，例如"计算 10 - 3"',
  parameters: [
    { name: 'a', type: 'number', description: '被减数' },
    { name: 'b', type: 'number', description: '减数' },
  ],
  returns: { type: 'number', description: '两数之差' },
  implementation: (a: number, b: number) => a - b,
});

/**
 * 乘法函数
 */
export const multiply = defineFunction({
  name: 'multiply',
  description: '将两个数字相乘',
  scenario: '当需要计算两个数的积时使用，例如"计算 4 * 6"',
  parameters: [
    { name: 'a', type: 'number', description: '第一个因数' },
    { name: 'b', type: 'number', description: '第二个因数' },
  ],
  returns: { type: 'number', description: '两数之积' },
  implementation: (a: number, b: number) => a * b,
});

/**
 * 除法函数
 */
export const divide = defineFunction({
  name: 'divide',
  description: '将两个数字相除',
  scenario: '当需要计算两个数的商时使用，例如"计算 20 / 4"',
  parameters: [
    { name: 'a', type: 'number', description: '被除数' },
    { name: 'b', type: 'number', description: '除数（不能为0）' },
  ],
  returns: { type: 'number', description: '两数之商' },
  implementation: (a: number, b: number) => {
    if (b === 0) {
      throw new Error('除数不能为0');
    }
    return a / b;
  },
});
