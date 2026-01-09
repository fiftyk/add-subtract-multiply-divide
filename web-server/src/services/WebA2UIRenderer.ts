/**
 * Web A2UI Renderer - Mock implementation for web server
 *
 * This renderer does nothing since web server uses SSE events for UI updates
 */

import { inject, injectable } from 'inversify';
import type { A2UIRenderer, A2UIRendererType } from '../../../dist/src/a2ui/A2UIRenderer.js';
import type { A2UIComponent, A2UIUserAction } from '../../../dist/src/a2ui/types.js';

/**
 * Mock A2UIRenderer for web server mode
 * Web server uses SSE events instead of A2UIRenderer for UI updates
 */
@injectable()
export class MockA2UIRenderer implements A2UIRenderer {
  begin(surfaceId: string, rootId: string): void {
    console.log(`[MockA2UIRenderer] begin: ${surfaceId}/${rootId}`);
  }

  update(surfaceId: string, components: A2UIComponent[]): void {
    console.log(`[MockA2UIRenderer] update: ${surfaceId}, ${components.length} components`);
  }

  remove(surfaceId: string, componentIds: string[]): void {
    console.log(`[MockA2UIRenderer] remove: ${surfaceId}, ${componentIds.length} components`);
  }

  end(surfaceId: string): void {
    console.log(`[MockA2UIRenderer] end: ${surfaceId}`);
  }

  onUserAction(handler: (action: A2UIUserAction) => void): void {
    // No-op: web server uses SSE for user input
    console.log('[MockA2UIRenderer] onUserAction called (no-op in web mode)');
  }

  async requestInput(surfaceId: string, componentId: string): Promise<A2UIUserAction> {
    // This should never be called in web mode
    console.warn('[MockA2UIRenderer] requestInput called - this should not happen in web mode');
    throw new Error('requestInput should not be called in web server mode');
  }
}
