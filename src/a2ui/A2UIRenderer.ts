/**
 * A2UI Renderer Interface
 * 
 * Abstract interface for rendering A2UI components.
 * Implementations: CLIRenderer, WebRenderer
 */

export type { A2UIRenderer as A2UIRendererType } from './A2UIRenderer.js';

import type { A2UIComponent, A2UIUserAction } from './types.js';

/**
 * DI Symbol for A2UIRenderer
 */
export const A2UIRenderer = Symbol('A2UIRenderer');

/**
 * A2UI Renderer interface
 * 
 * Provides methods to render A2UI components to different output targets.
 * CLI implementation renders to terminal, Web implementation renders via SSE.
 */
export interface A2UIRenderer {
  /**
   * Begin rendering a new surface
   * @param surfaceId - Unique identifier for the surface
   * @param rootId - ID of the root component
   */
  begin(surfaceId: string, rootId: string): void;

  /**
   * Update components on a surface
   * @param surfaceId - Surface to update
   * @param components - Components to add or update
   */
  update(surfaceId: string, components: A2UIComponent[]): void;

  /**
   * Remove components from a surface
   * @param surfaceId - Surface to update
   * @param componentIds - IDs of components to remove
   */
  remove(surfaceId: string, componentIds: string[]): void;

  /**
   * End rendering and cleanup
   * @param surfaceId - Surface to end
   */
  end(surfaceId: string): void;

  /**
   * Register handler for user actions
   * @param handler - Callback function for user actions
   */
  onUserAction(handler: (action: A2UIUserAction) => void): void;

  /**
   * Request user input (blocking for CLI)
   * Returns when user completes interaction
   * @param surfaceId - Surface containing the input component
   * @param componentId - Input component ID
   * @returns User action with input values
   */
  requestInput(surfaceId: string, componentId: string): Promise<A2UIUserAction>;
}
