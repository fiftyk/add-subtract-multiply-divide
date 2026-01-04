/**
 * Surface 管理器测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { SurfaceManager } from '../interfaces/index.js';
import { SurfaceManagerImpl } from '../implementations/SurfaceManager.js';

describe('SurfaceManager', () => {
  let manager: SurfaceManager;

  beforeEach(() => {
    const container = new Container();
    container.bind(SurfaceManager).to(SurfaceManagerImpl);
    manager = container.get(SurfaceManager);
  });

  describe('createSurface', () => {
    it('should create a new surface', () => {
      const surface = manager.createSurface('main');

      expect(surface).toBeDefined();
      expect(surface.surfaceId).toBe('main');
      expect(surface.components.size).toBe(0);
      expect(surface.rootComponentId).toBeNull();
      expect(surface.catalogId).toBeNull();
    });
  });

  describe('getSurface', () => {
    it('should return surface by id', () => {
      manager.createSurface('main');
      const surface = manager.getSurface('main');

      expect(surface).toBeDefined();
      expect(surface?.surfaceId).toBe('main');
    });

    it('should return undefined for non-existent surface', () => {
      const surface = manager.getSurface('non-existent');
      expect(surface).toBeUndefined();
    });
  });

  describe('hasSurface', () => {
    it('should return true for existing surface', () => {
      manager.createSurface('main');
      expect(manager.hasSurface('main')).toBe(true);
    });

    it('should return false for non-existent surface', () => {
      expect(manager.hasSurface('non-existent')).toBe(false);
    });
  });

  describe('deleteSurface', () => {
    it('should remove surface', () => {
      manager.createSurface('main');
      manager.deleteSurface('main');

      expect(manager.hasSurface('main')).toBe(false);
      expect(manager.getSurface('main')).toBeUndefined();
    });
  });

  describe('getAllSurfaces', () => {
    it('should return all surfaces', () => {
      manager.createSurface('surface1');
      manager.createSurface('surface2');

      const surfaces = Array.from(manager.getAllSurfaces());

      expect(surfaces).toHaveLength(2);
    });

    it('should return empty iterator when no surfaces', () => {
      const surfaces = Array.from(manager.getAllSurfaces());
      expect(surfaces).toHaveLength(0);
    });
  });
});
