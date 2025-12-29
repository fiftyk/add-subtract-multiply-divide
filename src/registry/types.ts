/**
 * 参数定义
 */
export interface ParameterDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}

/**
 * 返回值定义
 */
export interface ReturnDef {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  description: string;
}

/**
 * 函数定义
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  scenario: string;
  parameters: ParameterDef[];
  returns: ReturnDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: (...args: any[]) => any;
}

/**
 * 函数定义输入（用于 defineFunction）
 */
export interface FunctionDefinitionInput {
  name: string;
  description: string;
  scenario: string;
  parameters: ParameterDef[];
  returns: ReturnDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: (...args: any[]) => any;
}
