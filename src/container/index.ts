/**
 * Container Module Exports
 */

// Binding registration functions
export { registerCoreBindings } from './core.js';
export { registerCLIBindings } from './cli.js';
export { registerWebBindings } from './web.js';

// Pre-configured containers
export { container as cliContainer } from './cli-container.js';
export { container as webContainer } from './web-container.js';

// Symbols for dependency injection
export { LocalFunctionProviderSymbol } from '../function-provider/symbols.js';
