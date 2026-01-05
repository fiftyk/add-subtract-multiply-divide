/**
 * CLI Container (默认导出)
 * 
 * 这是 CLI 入口使用的容器配置
 * 为了向后兼容，保留 container.ts 作为 CLI 容器的入口
 */

export { container, MockServiceFactory } from './container/cli-container.js';
export { container as default } from './container/cli-container.js';
