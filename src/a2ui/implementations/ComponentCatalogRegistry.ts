/**
 * 组件目录注册表实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { ComponentCatalogRegistry, ComponentCatalog } from '../interfaces/index.js';

@injectable()
export class ComponentCatalogRegistryImpl implements ComponentCatalogRegistry {
  private catalogs: Map<string, ComponentCatalog> = new Map();
  private standardCatalog: ComponentCatalog | null = null;

  register(catalogId: string, catalog: ComponentCatalog): void {
    this.catalogs.set(catalogId, catalog);
  }

  get(catalogId: string): ComponentCatalog | undefined {
    return this.catalogs.get(catalogId);
  }

  getStandardCatalog(): ComponentCatalog {
    if (!this.standardCatalog) {
      throw new Error('Standard catalog not registered');
    }
    return this.standardCatalog;
  }

  has(catalogId: string): boolean {
    return this.catalogs.has(catalogId);
  }

  setStandardCatalog(catalog: ComponentCatalog): void {
    this.standardCatalog = catalog;
  }
}
