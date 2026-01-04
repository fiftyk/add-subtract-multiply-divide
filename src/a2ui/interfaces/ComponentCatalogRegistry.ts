/**
 * 组件目录注册表接口
 */

import type { ComponentCatalog } from './ComponentCatalog.js';

export const ComponentCatalogRegistry = Symbol('ComponentCatalogRegistry');

/**
 * 组件目录注册表接口
 */
export interface ComponentCatalogRegistry {
  /**
   * 注册目录
   */
  register(catalogId: string, catalog: ComponentCatalog): void;

  /**
   * 获取目录
   */
  get(catalogId: string): ComponentCatalog | undefined;

  /**
   * 获取标准目录
   */
  getStandardCatalog(): ComponentCatalog;

  /**
   * 检查目录是否存在
   */
  has(catalogId: string): boolean;
}
