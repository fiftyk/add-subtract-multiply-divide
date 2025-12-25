import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry, defineFunction } from '../registry';
import type { FunctionDefinition } from '../types';

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  describe('register', () => {
    it('should register a function', () => {
      const fn = defineFunction({
        name: 'add',
        description: '将两个数字相加',
        scenario: '当需要计算两个数的和时使用',
        parameters: [
          { name: 'a', type: 'number', description: '第一个加���' },
          { name: 'b', type: 'number', description: '第二个加数' },
        ],
        returns: { type: 'number', description: '两数之和' },
        implementation: (a: number, b: number) => a + b,
      });

      registry.register(fn);
      expect(registry.has('add')).toBe(true);
    });

    it('should throw if function name already exists', () => {
      const fn = defineFunction({
        name: 'add',
        description: '加法',
        scenario: '计算',
        parameters: [],
        returns: { type: 'number', description: '结果' },
        implementation: () => 0,
      });

      registry.register(fn);
      expect(() => registry.register(fn)).toThrow('Function "add" is already registered');
    });
  });

  describe('get', () => {
    it('should get a registered function', () => {
      const fn = defineFunction({
        name: 'multiply',
        description: '乘法',
        scenario: '计算乘积',
        parameters: [
          { name: 'a', type: 'number', description: '因数1' },
          { name: 'b', type: 'number', description: '因数2' },
        ],
        returns: { type: 'number', description: '积' },
        implementation: (a: number, b: number) => a * b,
      });

      registry.register(fn);
      const retrieved = registry.get('multiply');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('multiply');
    });

    it('should return undefined for non-existent function', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered functions', () => {
      const add = defineFunction({
        name: 'add',
        description: '加法',
        scenario: '加',
        parameters: [],
        returns: { type: 'number', description: '和' },
        implementation: () => 0,
      });

      const sub = defineFunction({
        name: 'subtract',
        description: '减法',
        scenario: '减',
        parameters: [],
        returns: { type: 'number', description: '差' },
        implementation: () => 0,
      });

      registry.register(add);
      registry.register(sub);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(f => f.name)).toContain('add');
      expect(all.map(f => f.name)).toContain('subtract');
    });
  });

  describe('execute', () => {
    it('should execute a registered function', async () => {
      const fn = defineFunction({
        name: 'add',
        description: '加法',
        scenario: '加',
        parameters: [
          { name: 'a', type: 'number', description: '' },
          { name: 'b', type: 'number', description: '' },
        ],
        returns: { type: 'number', description: '和' },
        implementation: (a: number, b: number) => a + b,
      });

      registry.register(fn);
      const result = await registry.execute('add', { a: 3, b: 5 });
      expect(result).toBe(8);
    });

    it('should throw for non-existent function', async () => {
      await expect(registry.execute('nonexistent', {})).rejects.toThrow('Function "nonexistent" not found');
    });

    it('should pass parameters in correct order', async () => {
      const fn = defineFunction({
        name: 'subtract',
        description: '减法',
        scenario: '减',
        parameters: [
          { name: 'a', type: 'number', description: '被减数' },
          { name: 'b', type: 'number', description: '减数' },
        ],
        returns: { type: 'number', description: '差' },
        implementation: (a: number, b: number) => a - b,
      });

      registry.register(fn);
      const result = await registry.execute('subtract', { a: 10, b: 3 });
      expect(result).toBe(7);
    });
  });
});

describe('defineFunction', () => {
  it('should create a valid function definition', () => {
    const fn = defineFunction({
      name: 'test',
      description: 'Test function',
      scenario: 'Testing',
      parameters: [{ name: 'x', type: 'string', description: 'Input' }],
      returns: { type: 'string', description: 'Output' },
      implementation: (x: string) => x.toUpperCase(),
    });

    expect(fn.name).toBe('test');
    expect(fn.description).toBe('Test function');
    expect(fn.parameters).toHaveLength(1);
    expect(fn.implementation('hello')).toBe('HELLO');
  });
});
