/**
 * Surface 管理器实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { SurfaceManager, SurfaceState } from '../interfaces/index.js';

@injectable()
export class SurfaceManagerImpl implements SurfaceManager {
  private surfaces: Map<string, SurfaceState> = new Map();

  createSurface(surfaceId: string): SurfaceState {
    const surface: SurfaceState = {
      surfaceId,
      components: new Map(),
      rootComponentId: null,
      dataModel: {},
      catalogId: null,
      createdAt: new Date(),
    };
    this.surfaces.set(surfaceId, surface);
    return surface;
  }

  getSurface(surfaceId: string): SurfaceState | undefined {
    return this.surfaces.get(surfaceId);
  }

  deleteSurface(surfaceId: string): void {
    this.surfaces.delete(surfaceId);
  }

  getAllSurfaces(): Iterable<SurfaceState> {
    return this.surfaces.values();
  }

  hasSurface(surfaceId: string): boolean {
    return this.surfaces.has(surfaceId);
  }
}
