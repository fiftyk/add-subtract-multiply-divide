/**
 * A2UI Component Registry
 *
 * Implements OCP (Open-Closed Principle):
 * - Open for extension: Add new components by registering them
 * - Closed for modification: No need to modify this file to add components
 *
 * SOLID Principles Applied:
 * - SRP: Registry only handles component registration and lookup
 * - OCP: Extensible without modification
 * - DIP: Depends on abstractions (Component), not concretions
 */

import { type Component, markRaw } from 'vue'
import type { A2UIComponentRegistry, A2UIComponentFactory } from '../types'

/**
 * A2UI 组件注册表实现
 *
 * 使用 WeakMap 存储组件映射，提供类型安全的注册和查找
 */
export class A2UIComponentRegistryImpl implements A2UIComponentRegistry {
  private readonly registry = new Map<string, Component>()

  /**
   * 注册组件
   * @param type - 组件类型名称（如 'TextField', 'Button' 等）
   * @param component - Vue 组件
   */
  register(
    type: string,
    component: Component
  ): void {
    if (!type || typeof type !== 'string') {
      throw new Error(`Invalid component type: ${type}`)
    }

    if (!component) {
      throw new Error(`Component for type "${type}" is undefined`)
    }

    // 使用 markRaw 避免 Vue 对组件进行响应式处理
    this.registry.set(type, markRaw(component))
    console.debug(`[A2UI] Registered component: ${type}`)
  }

  /**
   * 获取组件
   * @param type - 组件类型名称
   * @returns 组件或 undefined
   */
  get(type: string): Component | undefined {
    return this.registry.get(type)
  }

  /**
   * 检查组件是否已注册
   * @param type - 组件类型名称
   */
  has(type: string): boolean {
    return this.registry.has(type)
  }

  /**
   * 获取所有已注册的组件类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys())
  }

  /**
   * 清空注册表（主要用于测试）
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * 获取注册表大小
   */
  size(): number {
    return this.registry.size
  }
}

/**
 * A2UI 组件工厂实现
 * 组合注册表和组件创建逻辑
 */
export class A2UIComponentFactoryImpl implements A2UIComponentFactory {
  private readonly registry: A2UIComponentRegistry

  constructor(registry: A2UIComponentRegistry) {
    this.registry = registry
  }

  create(type: string, _id: string, _props: Record<string, unknown>): Component | null {
    const component = this.registry.get(type)

    if (!component) {
      console.warn(`[A2UI] Component type not found: ${type}`)
      return null
    }

    return component
  }
}

// ============================================
// Singleton Registry Instance
// ============================================

let globalRegistry: A2UIComponentRegistry | null = null

/**
 * 获取全局组件注册表（单例模式）
 */
export function getGlobalRegistry(): A2UIComponentRegistry {
  if (!globalRegistry) {
    globalRegistry = new A2UIComponentRegistryImpl()
  }
  return globalRegistry
}

/**
 * 设置全局组件注册表（用于测试）
 */
export function setGlobalRegistry(registry: A2UIComponentRegistry): void {
  globalRegistry = registry
}

/**
 * 便捷函数：注册组件
 */
export function registerA2UIComponent(
  type: string,
  component: Component
): void {
  getGlobalRegistry().register(type, component)
}

// Re-export types for convenience
export type { A2UIComponentRegistry }
export type { A2UIComponentFactory }
