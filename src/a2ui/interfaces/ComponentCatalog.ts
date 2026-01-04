/**
 * 组件目录接口
 */

import type { Component } from './Component.js';

export const ComponentCatalog = Symbol('ComponentCatalog');

/**
 * 组件目录接口
 */
export interface ComponentCatalog {
  /** 目录 ID */
  readonly id: string;

  /** 目录名称 */
  readonly name: string;

  /**
   * 获取组件定义
   */
  getComponentDefinition(componentType: string): ComponentDefinition | undefined;

  /**
   * 获取所有组件类型
   */
  getComponentTypes(): string[];

  /**
   * 验证组件是否有效
   */
  validateComponent(component: Component): { valid: boolean; errors: string[] };
}

/**
 * 组件定义
 */
export interface ComponentDefinition {
  properties: Record<string, PropertyDefinition>;
  events?: string[];
  children?: ChildrenDefinition;
}

/**
 * 属性定义
 */
export interface PropertyDefinition {
  type: 'bound' | 'literal' | 'enum' | 'array' | 'object';
  types?: string[];
  values?: (string | number)[];
  required?: boolean;
}

/**
 * 子组件定义
 */
export interface ChildrenDefinition {
  mode: 'explicit' | 'template' | 'single';
  templateDataBinding?: string;
}
