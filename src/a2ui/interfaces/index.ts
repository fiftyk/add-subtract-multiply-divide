/**
 * A2UI 协议接口导出
 */

// Message types
export type {
  A2UIMessage,
  SurfaceUpdateMessage,
  DataModelUpdateMessage,
  DataModelEntry,
  BeginRenderingMessage,
  DeleteSurfaceMessage,
  UserActionMessage,
  A2UIErrorMessage,
} from './A2UIMessage.js';

// BoundValue
export type { BoundValue } from './BoundValue.js';
export {
  LiteralString,
  LiteralNumber,
  LiteralBoolean,
  PathReference,
  PathWithDefault,
  isLiteralString,
  isLiteralNumber,
  isLiteralBoolean,
  isPathReference,
  resolveBoundValue,
} from './BoundValue.js';

// Component
export type { Component, ComponentProperties, SelectOption, ChildrenConfig, TemplateConfig } from './Component.js';

// Core interfaces
export { A2UISession, type A2UISessionOptions } from './A2UISession.js';
export { SurfaceManager, type SurfaceState } from './SurfaceManager.js';

// Component catalog
export { ComponentCatalog, type ComponentDefinition, type PropertyDefinition, type ChildrenDefinition } from './ComponentCatalog.js';
export { ComponentCatalogRegistry } from './ComponentCatalogRegistry.js';

// Transport
export { MessageSender, type SSEResponseWriter } from './MessageSender.js';
export { MessageReceiver } from './MessageReceiver.js';
export { Transport, type SSEServerConfig, type WebSocketConfig } from './Transport.js';

// Factory
export { A2UISessionFactory } from './A2UISessionFactory.js';
export { SurfaceFactory, type SurfaceConfig } from './SurfaceFactory.js';
