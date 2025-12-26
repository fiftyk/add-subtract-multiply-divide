// Export interface and Symbol (for DI container)
export { FunctionRegistry } from './interfaces/FunctionRegistry.js';
export { LocalFunctionRegistry, defineFunction } from './LocalFunctionRegistry.js';
export type {
  FunctionDefinition,
  FunctionDefinitionInput,
  ParameterDef,
  ReturnDef,
} from './types.js';
