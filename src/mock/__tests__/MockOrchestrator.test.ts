import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMockCodeGenerator } from '../interfaces/IMockCodeGenerator.js';
import type { IMockFileWriter } from '../interfaces/IMockFileWriter.js';
import type { IMockFunctionLoader } from '../interfaces/IMockFunctionLoader.js';
import type { IMockMetadataProvider } from '../interfaces/IMockMetadataProvider.js';
import type { MissingFunction } from '../../planner/types.js';
import type { FunctionRegistry } from '../../registry/index.js';
import { MockOrchestrator } from '../implementations/MockOrchestrator.js';

describe('MockOrchestrator', () => {
  let mockCodeGenerator: IMockCodeGenerator;
  let mockFileWriter: IMockFileWriter;
  let mockFunctionLoader: IMockFunctionLoader;
  let mockMetadataProvider: IMockMetadataProvider;
  let mockRegistry: FunctionRegistry;
  let orchestrator: MockOrchestrator;

  beforeEach(() => {
    mockCodeGenerator = {
      generate: vi.fn(),
    };
    mockFileWriter = {
      write: vi.fn(),
      ensureDirectory: vi.fn(),
    };
    mockFunctionLoader = {
      load: vi.fn(),
      register: vi.fn(),
    };
    mockMetadataProvider = {
      markAsMock: vi.fn(),
      isMock: vi.fn(),
      getMetadata: vi.fn(),
    };
    mockRegistry = {} as FunctionRegistry;

    orchestrator = new MockOrchestrator(
      mockCodeGenerator,
      mockFileWriter,
      mockFunctionLoader,
      mockMetadataProvider,
      mockRegistry
    );
  });

  it('should orchestrate full workflow for single function', async () => {
    const missingFunction: MissingFunction = {
      name: 'queryPatent',
      description: '查询专利信息',
      suggestedParameters: [
        { name: 'patentNumber', type: 'string', description: '专利号' },
      ],
      suggestedReturns: { type: 'object', description: '专利信息' },
    };

    const generatedCode = 'export const queryPatent = ...';
    const filePath = '/path/to/queryPatent-123.ts';
    const mockFunction = {
      name: 'queryPatent',
      description: '查询专利信息',
      scenario: '查询专利',
      parameters: [],
      returns: { type: 'object', description: '' },
      implementation: () => {},
    };

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue(generatedCode);
    vi.mocked(mockFileWriter.write).mockResolvedValue(filePath);
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([mockFunction]);

    const result = await orchestrator.generateAndRegisterMocks([
      missingFunction,
    ]);

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(1);
    expect(result.generatedFunctions[0].functionName).toBe('queryPatent');
    expect(result.generatedFunctions[0].filePath).toBe(filePath);
    expect(result.generatedFunctions[0].isMock).toBe(true);

    // Verify workflow steps
    expect(mockCodeGenerator.generate).toHaveBeenCalledWith({
      name: 'queryPatent',
      description: '查询专利信息',
      parameters: missingFunction.suggestedParameters,
      returns: missingFunction.suggestedReturns,
    });
    expect(mockFileWriter.write).toHaveBeenCalledWith(
      generatedCode,
      expect.stringMatching(/^queryPatent-\d+\.js$/)
    );
    expect(mockFunctionLoader.load).toHaveBeenCalledWith(filePath);
    expect(mockFunctionLoader.register).toHaveBeenCalledWith(mockRegistry, [
      mockFunction,
    ]);
    expect(mockMetadataProvider.markAsMock).toHaveBeenCalledWith(
      'queryPatent',
      expect.objectContaining({
        functionName: 'queryPatent',
        filePath: filePath,
        isMock: true,
      })
    );
  });

  it('should handle multiple functions', async () => {
    const missingFunctions: MissingFunction[] = [
      {
        name: 'func1',
        description: 'First function',
        suggestedParameters: [],
        suggestedReturns: { type: 'string', description: '' },
      },
      {
        name: 'func2',
        description: 'Second function',
        suggestedParameters: [],
        suggestedReturns: { type: 'number', description: '' },
      },
    ];

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue('code');
    vi.mocked(mockFileWriter.write).mockResolvedValue('/path/to/file.ts');
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([
      {
        name: 'func',
        description: '',
        scenario: '',
        parameters: [],
        returns: { type: 'string', description: '' },
        implementation: () => {},
      },
    ]);

    const result = await orchestrator.generateAndRegisterMocks(
      missingFunctions
    );

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(2);
    expect(mockCodeGenerator.generate).toHaveBeenCalledTimes(2);
    expect(mockFileWriter.write).toHaveBeenCalledTimes(2);
  });

  it('should collect errors for failed functions', async () => {
    const missingFunctions: MissingFunction[] = [
      {
        name: 'goodFunc',
        description: 'Good function',
        suggestedParameters: [],
        suggestedReturns: { type: 'string', description: '' },
      },
      {
        name: 'badFunc',
        description: 'Bad function',
        suggestedParameters: [],
        suggestedReturns: { type: 'string', description: '' },
      },
    ];

    vi.mocked(mockCodeGenerator.generate)
      .mockResolvedValueOnce('good code')
      .mockRejectedValueOnce(new Error('Generation failed'));

    vi.mocked(mockFileWriter.write).mockResolvedValue('/path/to/file.ts');
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([
      {
        name: 'goodFunc',
        description: '',
        scenario: '',
        parameters: [],
        returns: { type: 'string', description: '' },
        implementation: () => {},
      },
    ]);

    const result = await orchestrator.generateAndRegisterMocks(
      missingFunctions
    );

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(1);
    expect(result.generatedFunctions[0].functionName).toBe('goodFunc');
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].functionName).toBe('badFunc');
    expect(result.errors![0].error).toContain('Generation failed');
  });

  it('should use timestamp in filename', async () => {
    const missingFunction: MissingFunction = {
      name: 'testFunc',
      description: 'Test',
      suggestedParameters: [],
      suggestedReturns: { type: 'string', description: '' },
    };

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue('code');
    vi.mocked(mockFileWriter.write).mockResolvedValue('/path/to/file.ts');
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([]);

    await orchestrator.generateAndRegisterMocks([missingFunction]);

    expect(mockFileWriter.write).toHaveBeenCalledWith(
      'code',
      expect.stringMatching(/^testFunc-\d+\.js$/)
    );
  });

  it('should include generated timestamp in metadata', async () => {
    const missingFunction: MissingFunction = {
      name: 'testFunc',
      description: 'Test',
      suggestedParameters: [],
      suggestedReturns: { type: 'string', description: '' },
    };

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue('code');
    vi.mocked(mockFileWriter.write).mockResolvedValue('/path/to/file.ts');
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([
      {
        name: 'testFunc',
        description: '',
        scenario: '',
        parameters: [],
        returns: { type: 'string', description: '' },
        implementation: () => {},
      },
    ]);

    const result = await orchestrator.generateAndRegisterMocks([
      missingFunction,
    ]);

    expect(result.generatedFunctions[0].generatedAt).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });
});
