/**
 * Interface for LLM client operations
 * Responsibility: Abstract LLM API calls for code generation
 * This allows easy replacement of LLM providers (Anthropic -> OpenAI, etc.)
 */
export interface ILLMClient {
  /**
   * Generate code using LLM
   * @param prompt - The prompt to send to LLM
   * @returns Generated code as string
   */
  generateCode(prompt: string): Promise<string>;
}
