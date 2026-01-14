/**
 * Interface for LLM adapters
 * Responsibility: Abstract LLM API calls for code generation
 * This allows easy replacement of different LLM providers
 * (e.g., Anthropic API, Claude Code CLI, etc.)
 */
export interface LLMAdapter {
  /**
   * Generate code based on the provided prompt
   * @param prompt - The prompt to send to LLM
   * @returns Generated code as string
   */
  generateCode(prompt: string): Promise<string>;
}

export const LLMAdapter = Symbol('LLMAdapter');
