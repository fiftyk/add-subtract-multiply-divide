/**
 * Surface 管理器接口
 */

import type { Component } from './Component.js';

export const SurfaceManager = Symbol('SurfaceManager');

/**
 * Surface 管理器接口
 */
export interface SurfaceManager {
  /**
   * 创建 Surface
   */
  createSurface(surfaceId: string): SurfaceState;

  /**
   * 获取 Surface 状态
   */
  getSurface(surfaceId: string): SurfaceState | undefined;

  /**
   * 删除 Surface
   */
  deleteSurface(surfaceId: string): void;

  /**
   * 获取所有 Surface
   */
  getAllSurfaces(): Iterable<SurfaceState>;

  /**
   * 检查 Surface 是否存在
   */
  hasSurface(surfaceId: string): boolean;
}

/**
 * Surface 状态
 */
export interface SurfaceState {
  readonly surfaceId: string;
  components: Map<string, Component>;
  rootComponentId: string | null;
  dataModel: Record<string, unknown>;
  catalogId: string | null;
  readonly createdAt: Date;
}
