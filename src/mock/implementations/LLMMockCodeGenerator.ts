import type { IMockCodeGenerator } from '../interfaces/IMockCodeGenerator.js';
import type { ILLMClient } from '../interfaces/ILLMClient.js';
import type { MockFunctionSpec } from '../types.js';
import {
  buildMockCodeGenerationPrompt,
  extractCodeFromLLMResponse,
} from '../prompts.js';

/**
 * Generates mock function code using LLM
 * Follows SRP: Only responsible for code generation
 */
export class LLMMockCodeGenerator implements IMockCodeGenerator {
  private importPath: string;

  constructor(
    private llmClient: ILLMClient,
    importPath?: string
  ) {
    // 默认路径：从 .data/plans/{planId}/mocks/ 到 dist/src/registry/index.js
    this.importPath = importPath || '../../../../dist/src/registry/index.js';
  }

  /**
   * Generate mock function code from specification
   */
  async generate(spec: MockFunctionSpec): Promise<string> {
    const prompt = buildMockCodeGenerationPrompt(spec, this.importPath);
    const rawCode = await this.llmClient.generateCode(prompt);
    const extractedCode = extractCodeFromLLMResponse(rawCode);
    return this.formatCode(extractedCode, spec);
  }

  /**
   * Format generated code with metadata and comments
   */
  private formatCode(code: string, spec: MockFunctionSpec): string {
    const timestamp = new Date().toISOString();

    // Ensure the code has proper import
    let formattedCode = code;
    if (!code.includes("import { defineFunction }")) {
      formattedCode = `import { defineFunction } from '${this.importPath}';\n\n${code}`;
    } else {
      // Normalize import path to use the correct one
      formattedCode = code.replace(
        /from ['"][^'"]+registry\/index\.js['"]/g,
        `from '${this.importPath}'`
      );
    }

    // Add header comments
    const header = `// 🤖 AUTO-GENERATED MOCK FUNCTION
// Function: ${spec.name}
// Description: ${spec.description}
// TODO: Replace with real implementation
// Generated at: ${timestamp}
`;

    return `${header}\n${formattedCode}`;
  }
}
