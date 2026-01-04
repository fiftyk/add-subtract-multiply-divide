/**
 * Surface 工厂实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { SurfaceFactory, SurfaceConfig } from '../interfaces/index.js';

@injectable()
export class SurfaceFactoryImpl implements SurfaceFactory {
  create(sessionId: string, surfaceId: string, catalogId: string): SurfaceConfig {
    return {
      surfaceId,
      catalogId,
      components: [],
      dataModel: {},
    };
  }
}
