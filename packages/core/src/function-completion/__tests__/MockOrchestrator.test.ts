import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FunctionCodeGenerator } from '../interfaces/FunctionCodeGenerator.js';
import type { FunctionFileWriter } from '../interfaces/FunctionFileWriter.js';
import type { FunctionLoader } from '../interfaces/FunctionLoader.js';
import type { CompletionMetadataProvider } from '../interfaces/CompletionMetadataProvider.js';
import type { MissingFunction } from '../../planner/types.js';
import type { FunctionRegistry } from '../../registry/index.js';
import type { Storage } from '../../storage/index.js';
import { CompletionOrchestratorImpl } from '../implementations/CompletionOrchestrator.js';

describe('CompletionOrchestrator', () => {
  let mockCodeGenerator: FunctionCodeGenerator;
  let mockFileWriter: FunctionFileWriter;
  let mockFunctionLoader: FunctionLoader;
  let mockMetadataProvider: CompletionMetadataProvider;
  let mockRegistry: FunctionRegistry;
  let mockStorage: Storage;
  let orchestrator: CompletionOrchestrator;

  const testPlanId = 'plan-test123';

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

    // Mock Storage methods used by CompletionOrchestrator
    mockStorage = {
      getPlanMocksDir: vi.fn().mockReturnValue(`/data/plans/${testPlanId}/mocks`),
      savePlanMock: vi.fn().mockResolvedValue(`mocks/queryPatent-v1.js`),
    } as unknown as Storage;

    orchestrator = new CompletionOrchestratorImpl(
      testPlanId,
      mockStorage,
      mockCodeGenerator,
      mockFileWriter,
      mockFunctionLoader,
      mockMetadataProvider,
      mockRegistry
    );
  });

  it('should orchestrate full workflow for single function with versioning', async () => {
    const missingFunction: MissingFunction = {
      name: 'queryPatent',
      description: '查询专利信息',
      suggestedParameters: [
        { name: 'patentNumber', type: 'string', description: '专利号' },
      ],
      suggestedReturns: { type: 'object', description: '专利信息' },
    };

    const generatedCode = 'export const queryPatent = ...';
    const mockFunction = {
      name: 'queryPatent',
      description: '查询专利信息',
      scenario: '查询专利',
      parameters: [],
      returns: { type: 'object', description: '' },
      implementation: () => {},
    };

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue(generatedCode);
    vi.mocked(mockStorage.savePlanMock).mockResolvedValue(
      'mocks/queryPatent-v1.js'
    );
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([mockFunction]);

    const result = await orchestrator.generateAndRegisterMocks([
      missingFunction,
    ]);

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(1);
    expect(result.generatedFunctions[0].functionName).toBe('queryPatent');
    expect(result.generatedFunctions[0].filePath).toContain('queryPatent-v1.js');
    expect(result.generatedFunctions[0].isMock).toBe(true);

    // Verify workflow steps
    expect(mockCodeGenerator.generate).toHaveBeenCalledWith({
      name: 'queryPatent',
      description: '查询专利信息',
      parameters: missingFunction.suggestedParameters,
      returns: missingFunction.suggestedReturns,
    });

    // Verify storage.savePlanMock was called with version info
    expect(mockStorage.savePlanMock).toHaveBeenCalledWith(
      testPlanId,
      'queryPatent',
      1, // version 1 for first generation
      generatedCode
    );

    expect(mockFunctionLoader.load).toHaveBeenCalled();
    expect(mockFunctionLoader.register).toHaveBeenCalledWith(mockRegistry, [
      mockFunction,
    ]);
    expect(mockMetadataProvider.markAsMock).toHaveBeenCalledWith(
      'queryPatent',
      expect.objectContaining({
        functionName: 'queryPatent',
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
    vi.mocked(mockStorage.savePlanMock).mockResolvedValue(
      'mocks/func-v1.js'
    );
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

    const result = await orchestrator.generateAndRegisterMocks(missingFunctions);

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(2);
    expect(mockCodeGenerator.generate).toHaveBeenCalledTimes(2);
    expect(mockStorage.savePlanMock).toHaveBeenCalledTimes(2);
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

    vi.mocked(mockStorage.savePlanMock).mockResolvedValue(
      'mocks/goodFunc-v1.js'
    );
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

    const result = await orchestrator.generateAndRegisterMocks(missingFunctions);

    expect(result.success).toBe(true);
    expect(result.generatedFunctions).toHaveLength(1);
    expect(result.generatedFunctions[0].functionName).toBe('goodFunc');
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].functionName).toBe('badFunc');
    expect(result.errors![0].error).toContain('Generation failed');
  });

  it('should use version numbers in filename', async () => {
    const missingFunction: MissingFunction = {
      name: 'testFunc',
      description: 'Test',
      suggestedParameters: [],
      suggestedReturns: { type: 'string', description: '' },
    };

    vi.mocked(mockCodeGenerator.generate).mockResolvedValue('code');
    vi.mocked(mockStorage.savePlanMock).mockResolvedValue(
      'mocks/testFunc-v1.js'
    );
    vi.mocked(mockFunctionLoader.load).mockResolvedValue([]);

    await orchestrator.generateAndRegisterMocks([missingFunction]);

    expect(mockStorage.savePlanMock).toHaveBeenCalledWith(
      testPlanId,
      'testFunc',
      1, // version 1
      'code'
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
    vi.mocked(mockStorage.savePlanMock).mockResolvedValue(
      'mocks/testFunc-v1.js'
    );
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
