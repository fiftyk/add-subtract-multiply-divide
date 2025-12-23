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
  constructor(private llmClient: ILLMClient) {}

  /**
   * Generate mock function code from specification
   */
  async generate(spec: MockFunctionSpec): Promise<string> {
    const prompt = buildMockCodeGenerationPrompt(spec);
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
      formattedCode = `import { defineFunction } from '../../dist/src/registry/index.js';\n\n${code}`;
    } else {
      // Replace incorrect import path with correct one
      formattedCode = code.replace(
        /from ['"]\.\.\/\.\.\/src\/registry\/index\.js['"]/g,
        "from '../../dist/src/registry/index.js'"
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
