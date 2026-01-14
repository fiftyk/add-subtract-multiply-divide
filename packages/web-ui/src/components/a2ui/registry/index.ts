/**
 * A2UI Component Registry
 *
 * Exports:
 * - A2UIComponentRegistry: Interface for component registry
 * - A2UIComponentRegistryImpl: Default implementation
 * - A2UIComponentFactory: Interface for component factory
 * - getGlobalRegistry: Get singleton registry instance
 * - registerA2UIComponent: Convenience function to register components
 */

export {
  A2UIComponentRegistryImpl,
  A2UIComponentFactoryImpl,
  getGlobalRegistry,
  setGlobalRegistry,
  registerA2UIComponent,
} from './A2UIComponentRegistry.js'

export type {
  A2UIComponentRegistry,
  A2UIComponentFactory,
} from '../types.js'
