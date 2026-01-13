/**
 * Built-in Math Functions for fn-orchestrator
 *
 * These functions are available in both CLI and Web modes
 */

// @ts-ignore - Importing from parent project's dist folder
import type { FunctionDefinition } from '../../../dist/src/registry/types.js';

/**
 * Add two numbers
 */
export const add: FunctionDefinition = {
  name: 'add',
  description: 'Add two numbers together',
  scenario: 'Basic arithmetic operations',
  parameters: [
    { name: 'a', type: 'number', description: 'First number' },
    { name: 'b', type: 'number', description: 'Second number' }
  ],
  returns: { type: 'number', description: 'Sum of a and b' },
  implementation: (a: number, b: number): number => a + b
};

/**
 * Subtract two numbers
 */
export const subtract: FunctionDefinition = {
  name: 'subtract',
  description: 'Subtract second number from first',
  scenario: 'Basic arithmetic operations',
  parameters: [
    { name: 'a', type: 'number', description: 'First number (minuend)' },
    { name: 'b', type: 'number', description: 'Second number (subtrahend)' }
  ],
  returns: { type: 'number', description: 'Difference between a and b' },
  implementation: (a: number, b: number): number => a - b
};

/**
 * Multiply two numbers
 */
export const multiply: FunctionDefinition = {
  name: 'multiply',
  description: 'Multiply two numbers together',
  scenario: 'Basic arithmetic operations',
  parameters: [
    { name: 'a', type: 'number', description: 'First number' },
    { name: 'b', type: 'number', description: 'Second number' }
  ],
  returns: { type: 'number', description: 'Product of a and b' },
  implementation: (a: number, b: number): number => a * b
};

/**
 * Divide two numbers
 */
export const divide: FunctionDefinition = {
  name: 'divide',
  description: 'Divide first number by second',
  scenario: 'Basic arithmetic operations',
  parameters: [
    { name: 'a', type: 'number', description: 'Dividend' },
    { name: 'b', type: 'number', description: 'Divisor (cannot be zero)' }
  ],
  returns: { type: 'number', description: 'Quotient of a divided by b' },
  implementation: (a: number, b: number): number => {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
};

/**
 * Get the remainder of division
 */
export const modulo: FunctionDefinition = {
  name: 'modulo',
  description: 'Get the remainder of division',
  scenario: 'Basic arithmetic operations',
  parameters: [
    { name: 'a', type: 'number', description: 'Dividend' },
    { name: 'b', type: 'number', description: 'Divisor (cannot be zero)' }
  ],
  returns: { type: 'number', description: 'Remainder of a divided by b' },
  implementation: (a: number, b: number): number => {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a % b;
  }
};

/**
 * Round a number to specified decimal places
 */
export const round: FunctionDefinition = {
  name: 'round',
  description: 'Round a number to specified decimal places',
  scenario: 'Number formatting',
  parameters: [
    { name: 'value', type: 'number', description: 'The number to round' },
    { name: 'decimals', type: 'number', description: 'Number of decimal places (default: 0)' }
  ],
  returns: { type: 'number', description: 'Rounded number' },
  implementation: (value: number, decimals: number = 0): number => {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
};

/**
 * Get the maximum of two numbers
 */
export const max: FunctionDefinition = {
  name: 'max',
  description: 'Get the maximum of two numbers',
  scenario: 'Comparison operations',
  parameters: [
    { name: 'a', type: 'number', description: 'First number' },
    { name: 'b', type: 'number', description: 'Second number' }
  ],
  returns: { type: 'number', description: 'Maximum of a and b' },
  implementation: (a: number, b: number): number => Math.max(a, b)
};

/**
 * Get the minimum of two numbers
 */
export const min: FunctionDefinition = {
  name: 'min',
  description: 'Get the minimum of two numbers',
  scenario: 'Comparison operations',
  parameters: [
    { name: 'a', type: 'number', description: 'First number' },
    { name: 'b', type: 'number', description: 'Second number' }
  ],
  returns: { type: 'number', description: 'Minimum of a and b' },
  implementation: (a: number, b: number): number => Math.min(a, b)
};

/**
 * Generate a random number between min and max
 */
export const random: FunctionDefinition = {
  name: 'random',
  description: 'Generate a random number between min and max (inclusive)',
  scenario: 'Random number generation',
  parameters: [
    { name: 'min', type: 'number', description: 'Minimum value (default: 0)' },
    { name: 'max', type: 'number', description: 'Maximum value (default: 1)' }
  ],
  returns: { type: 'number', description: 'Random number between min and max' },
  implementation: (min: number = 0, max: number = 1): number => {
    return Math.random() * (max - min) + min;
  }
};

/**
 * Calculate the absolute value
 */
export const abs: FunctionDefinition = {
  name: 'abs',
  description: 'Get the absolute value of a number',
  scenario: 'Math operations',
  parameters: [
    { name: 'value', type: 'number', description: 'The number' }
  ],
  returns: { type: 'number', description: 'Absolute value' },
  implementation: (value: number): number => Math.abs(value)
};

/**
 * Calculate the power of a number
 */
export const power: FunctionDefinition = {
  name: 'power',
  description: 'Calculate the power of a number (exponentiation)',
  scenario: 'Math operations',
  parameters: [
    { name: 'base', type: 'number', description: 'Base number' },
    { name: 'exponent', type: 'number', description: 'Exponent' }
  ],
  returns: { type: 'number', description: 'Base raised to the power of exponent' },
  implementation: (base: number, exponent: number): number => Math.pow(base, exponent)
};

/**
 * Calculate the square root
 */
export const sqrt: FunctionDefinition = {
  name: 'sqrt',
  description: 'Calculate the square root of a number',
  scenario: 'Math operations',
  parameters: [
    { name: 'value', type: 'number', description: 'The number (must be non-negative)' }
  ],
  returns: { type: 'number', description: 'Square root' },
  implementation: (value: number): number => {
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    return Math.sqrt(value);
  }
};

/**
 * All built-in math functions
 */
export const builtInMathFunctions = [
  add,
  subtract,
  multiply,
  divide,
  modulo,
  round,
  max,
  min,
  random,
  abs,
  power,
  sqrt
];

/**
 * Register all built-in math functions to a function provider
 */
export function registerBuiltInMathFunctions(
  registerFn: (fn: FunctionDefinition) => void
): void {
  for (const fn of builtInMathFunctions) {
    registerFn(fn);
  }
  console.log(`[BuiltInFunctions] Registered ${builtInMathFunctions.length} math functions`);
}
