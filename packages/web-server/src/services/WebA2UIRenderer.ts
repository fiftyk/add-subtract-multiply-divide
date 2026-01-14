/**
 * Web A2UI Renderer - Mock implementation for web server
 *
 * This renderer does nothing since web server uses SSE events for UI updates.
 * The actual UI rendering is done by the web client (Vue/React) using
 * the inputUI/resultUI definitions from the plan JSON.
 *
 * A2UI v0.8 BoundValue types are supported in the component definitions,
 * and the web client is responsible for resolving them.
 */

import { inject, injectable } from 'inversify';
import type { A2UIRenderer, A2UIRendererType } from '@fn-orchestrator/core/a2ui/A2UIRenderer.js';
import type { A2UIComponent, A2UIUserAction, SurfaceDefinition } from '@fn-orchestrator/core/a2ui/types.js';
import { UserInputRequiredError } from '@fn-orchestrator/core/errors';

/**
 * Mock A2UIRenderer for web server mode
 * Web server uses SSE events instead of A2UIRenderer for UI updates
 */
@injectable()
export class MockA2UIRenderer implements A2UIRenderer {
  private surfaceCount = 0;

  begin(surfaceId: string, rootId: string): void {
    this.surfaceCount++;
    console.log(`[MockA2UIRenderer] begin: ${surfaceId}/${rootId}`);
  }

  update(surfaceId: string, components: A2UIComponent[]): void {
    console.log(`[MockA2UIRenderer] update: ${surfaceId}, ${components.length} components`);
    for (const comp of components) {
      const [[type]] = Object.entries(comp.component);
      console.log(`  - ${comp.id}: ${type}`);
    }
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
    // Extract step ID from surfaceId (format: user-input-{stepId})
    const stepId = parseInt(surfaceId.replace('user-input-', ''), 10) || 0;
    console.log(`[MockA2UIRenderer] User input required for step ${stepId}, component ${componentId}`);
    // Throw special error to signal that user input is required
    throw new UserInputRequiredError(stepId);
  }

  /**
   * Get statistics about rendered surfaces
   */
  getStats(): { surfaceCount: number } {
    return { surfaceCount: this.surfaceCount };
  }
}

/**
 * Web-compatible Surface Definition helper
 *
 * Converts A2UI component array to a format suitable for web clients
 */
export function toWebSurfaceDefinition(
  surfaceId: string,
  rootId: string,
  components: A2UIComponent[]
): SurfaceDefinition {
  return {
    surfaceId,
    root: rootId,
    components,
  };
}
