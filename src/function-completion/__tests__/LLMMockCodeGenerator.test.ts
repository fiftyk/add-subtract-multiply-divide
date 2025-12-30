import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMAdapter } from '../interfaces/LLMAdapter.js';
import type { FunctionCompletionSpec } from '../types.js';
import { LLMFunctionCodeGeneratorImpl } from '../implementations/LLMFunctionCodeGenerator.js';

describe('LLMFunctionCodeGenerator', () => {
  let mockLLMClient: LLMAdapter;
  let generator: LLMFunctionCodeGenerator;

  beforeEach(() => {
    mockLLMClient = {
      generateCode: vi.fn(),
    };
    generator = new LLMFunctionCodeGeneratorImpl(mockLLMClient);
  });

  it('should generate valid TypeScript code with defineFunction', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'queryPatent',
      description: '查询专利详细信息',
      parameters: [
        { name: 'patentNumber', type: 'string', description: '专利号' },
      ],
      returns: { type: 'object', description: '专利详细信息对象' },
    };

    vi.mocked(mockLLMClient.generateCode).mockResolvedValue(
      `export const queryPatent = defineFunction({
  name: 'queryPatent',
  description: '查询专利详细信息',
  scenario: '通过专利号查询专利的详细信息',
  parameters: [{ name: 'patentNumber', type: 'string', description: '专利号' }],
  returns: { type: 'object', description: '专利详细信息对象' },
  implementation: (patentNumber: string) => {
    return { patentNumber, title: 'Mock Patent' };
  }
});`
    );

    const code = await generator.generate(spec);

    expect(code).toContain('export const queryPatent');
    expect(code).toContain('defineFunction');
    expect(mockLLMClient.generateCode).toHaveBeenCalledOnce();
  });

  it('should add AUTO-GENERATED comment marker', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'testFunc',
      description: 'Test function',
      parameters: [],
      returns: { type: 'string', description: 'Result' },
    };

    vi.mocked(mockLLMClient.generateCode).mockResolvedValue(
      'export const testFunc = defineFunction({...});'
    );

    const code = await generator.generate(spec);

    expect(code).toContain('🤖 AUTO-GENERATED MOCK FUNCTION');
    expect(code).toContain('TODO: Replace with real implementation');
  });

  it('should add generation timestamp', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'testFunc',
      description: 'Test function',
      parameters: [],
      returns: { type: 'string', description: 'Result' },
    };

    vi.mocked(mockLLMClient.generateCode).mockResolvedValue(
      'export const testFunc = defineFunction({...});'
    );

    const code = await generator.generate(spec);

    expect(code).toContain('Generated at:');
    expect(code).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
  });

  it('should include import statement for defineFunction', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'testFunc',
      description: 'Test function',
      parameters: [],
      returns: { type: 'string', description: 'Result' },
    };

    vi.mocked(mockLLMClient.generateCode).mockResolvedValue(
      'export const testFunc = defineFunction({...});'
    );

    const code = await generator.generate(spec);

    expect(code).toContain("import { defineFunction } from");
  });

  it('should handle multi-parameter functions', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'add',
      description: 'Add two numbers',
      parameters: [
        { name: 'a', type: 'number', description: 'First number' },
        { name: 'b', type: 'number', description: 'Second number' },
      ],
      returns: { type: 'number', description: 'Sum' },
    };

    vi.mocked(mockLLMClient.generateCode).mockResolvedValue(
      'export const add = defineFunction({...});'
    );

    const code = await generator.generate(spec);

    expect(code).toBeDefined();
    expect(mockLLMClient.generateCode).toHaveBeenCalledWith(
      expect.stringContaining('add')
    );
    expect(mockLLMClient.generateCode).toHaveBeenCalledWith(
      expect.stringContaining('number')
    );
  });

  it('should propagate LLM errors', async () => {
    const spec: FunctionCompletionSpec = {
      name: 'testFunc',
      description: 'Test function',
      parameters: [],
      returns: { type: 'string', description: 'Result' },
    };

    vi.mocked(mockLLMClient.generateCode).mockRejectedValue(
      new Error('LLM API error')
    );

    await expect(generator.generate(spec)).rejects.toThrow('LLM API error');
  });
});
