/**
 * A2UI 协议消息类型定义
 *
 * Google A2UI (Agent-to-UI) 协议的 TypeScript 类型定义
 * https://a2ui.org/specification/v0.8-a2ui/
 */

/**
 * 联合类型：所有 A2UI 消息
 */
export type A2UIMessage =
  | SurfaceUpdateMessage
  | DataModelUpdateMessage
  | BeginRenderingMessage
  | DeleteSurfaceMessage
  | UserActionMessage
  | A2UIErrorMessage;

/**
 * Data Model Entry 数据条目
 */
export interface DataModelEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: DataModelEntry[];
}

/**
 * Surface Update 消息
 * 定义或替换 UI 组件树
 */
export interface SurfaceUpdateMessage {
  surfaceUpdate: {
    surfaceId: string;
    // Note: Component is defined in Component.ts to avoid circular imports
    components: Array<{
      id: string;
      component: Record<string, Record<string, unknown>>;
      children?: {
        explicitList?: string[];
        template?: {
          dataBinding: string;
          componentId: string;
        };
      };
    }>;
  };
}

/**
 * Data Model Update 消息
 * 更新动态数据状态
 */
export interface DataModelUpdateMessage {
  dataModelUpdate: {
    surfaceId: string;
    path?: string;
    contents: DataModelEntry[];
  };
}

/**
 * Begin Rendering 消息
 * 触发渲染
 */
export interface BeginRenderingMessage {
  beginRendering: {
    surfaceId: string;
    catalogId: string;
    root: string;
  };
}

/**
 * Delete Surface 消息
 * 删除 UI 区域
 */
export interface DeleteSurfaceMessage {
  deleteSurface: {
    surfaceId: string;
  };
}

/**
 * 用户动作消息（Client → Server）
 */
export interface UserActionMessage {
  userAction: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
  };
}

/**
 * 错误消息
 */
export interface A2UIErrorMessage {
  error: {
    code: string;
    details?: string;
  };
}
