/**
 * Surface 工厂接口
 */

export const SurfaceFactory = Symbol('SurfaceFactory');

/**
 * Surface 工厂接口
 */
export interface SurfaceFactory {
  /**
   * 创建 Surface
   */
  create(sessionId: string, surfaceId: string, catalogId: string): SurfaceConfig;
}

/**
 * Surface 配置
 */
export interface SurfaceConfig {
  surfaceId: string;
  catalogId: string;
  components: Array<Record<string, Record<string, unknown>>>;
  dataModel?: Record<string, unknown>;
}
