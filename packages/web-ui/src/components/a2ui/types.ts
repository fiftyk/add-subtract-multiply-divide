/**
 * A2UI Component Types
 *
 * Defines interfaces and types for A2UI v0.8 components
 */

// ============================================
// BoundValue - Core A2UI Data Binding
// ============================================

/**
 * A2UI 绑定值 - 支持字面量和路径引用
 * 用于所有需要动态数据的属性
 */
export type BoundValue =
  | { literalString: string }
  | { path: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { explicitList: Array<Record<string, unknown>> }

// 便捷类型别名
export type TextValue = { literalString: string } | { path: string }
export type NumberValue = { literalNumber: number } | { path: string }
export type BooleanValue = { literalBoolean: boolean } | { path: string }
export type ListValue = { literalString: string } | { path: string }

// ============================================
// Base Component Interface
// ============================================

/**
 * A2UI 组件属性基类（不包含 id，id 是单独传递的）
 */
export interface A2UIComponentProps {
  [key: string]: unknown
}

/**
 * A2UI 组件定义
 */
export interface A2UIComponentDefinition {
  id: string
  component: Record<string, Record<string, unknown>>
}

/**
 * A2UI 表面定义 (Surface)
 */
export interface A2UISurfaceDefinition {
  surfaceId: string
  rootId: string
  components: A2UIComponentDefinition[]
}

// ============================================
// Input Component Interfaces
// ============================================

// ============================================
// A2UI v0.8 Component Interfaces
// Based on Google A2UI specification
// https://github.com/google/A2UI
// ============================================

/**
 * TextField Component - A2UI v0.8
 *
 * @see https://github.com/google/A2UI/blob/main/specification/v0_8/json/standard_catalog_definition.json
 */
export interface TextFieldProps {
  /** 标签文本 */
  label: TextValue
  /** 文本值绑定路径（用于数据绑定） */
  text?: TextValue
  /** 输入类型 */
  textFieldType?: { literalString: 'shortText' | 'longText' | 'number' | 'date' | 'obscured' }
  /** 占位符 */
  placeholder?: TextValue
  /** 是否必填 */
  required?: BooleanValue
  /** 描述文本 */
  description?: TextValue
  /** 禁用状态 */
  disabled?: BooleanValue
}

/**
 * DateTimeInput Component - A2UI v0.8
 *
 * @see https://github.com/google/A2UI/blob/main/specification/v0_8/json/standard_catalog_definition.json
 */
export interface DateTimeInputProps {
  /** 日期时间值绑定路径（用于数据绑定） */
  value: TextValue
  /** 是否启用日期选择 */
  enableDate?: BooleanValue
  /** 是否启用时间选择 */
  enableTime?: BooleanValue
  /** 标签文本 */
  label?: TextValue
  /** 最小日期/时间 */
  minDate?: TextValue
  /** 最大日期/时间 */
  maxDate?: TextValue
  /** 是否必填 */
  required?: BooleanValue
  /** 禁用状态 */
  disabled?: BooleanValue
}

// ============================================
// A2UI v0.8 Specification - MultipleChoice Options Format
// ============================================

/**
 * MultipleChoice Component - A2UI v0.8
 *
 * @see https://github.com/google/A2UI/blob/main/specification/v0_8/json/standard_catalog_definition.json
 *
 * A2UI v0.8 规范定义：
 * - selections: 用户选择绑定路径（literalArray 静态数组 或 path 动态路径）
 * - options: 静态选项数组，每个选项有 label 和 value
 * - maxAllowedSelections: 最大选择数量
 */
export interface MultipleChoiceProps {
  /** 用户选择绑定路径（literalArray 静态数组 或 path 动态路径） */
  selections: { literalArray: string[] } | { path: string }
  /** 静态选项列表（每个选项有 label 和 value） */
  options: Array<{
    label: { literalString?: string; path?: string }
    value: string
  }>
  /** 最大选择数量 */
  maxAllowedSelections?: NumberValue
  /** 最小选择数量 */
  minAllowedSelections?: NumberValue
  /** 标签文本 */
  label?: TextValue
  /** 是否必填 */
  required?: BooleanValue
}

export interface SliderProps {
  label: TextValue
  name: { literalString: string }
  value: NumberValue
  minValue: NumberValue
  maxValue: NumberValue
  step?: NumberValue
  disabled?: BooleanValue
}

/**
 * Button Component - A2UI v0.8
 *
 * @see https://github.com/google/A2UI/blob/main/specification/v0_8/json/standard_catalog_definition.json
 *
 * A2UI v0.8 规范定义：
 * - child: 要显示的组件ID
 * - action: 动作配置（name 和可选的 context）
 */
export interface ButtonProps {
  /** 要显示的组件ID */
  child: string
  /** 是否为主要按钮 */
  primary?: BooleanValue
  /** 动作配置 */
  action?: {
    name: string
    context?: Array<{
      key: string
      value: { path?: string; literalString?: string; literalNumber?: number; literalBoolean?: boolean }
    }>
  }
  /** 禁用状态 */
  disabled?: BooleanValue
}

/**
 * Action context item for Button action
 */
export interface ButtonActionContextItem {
  key: string
  value: { path?: string; literalString?: string; literalNumber?: number; literalBoolean?: boolean }
}

// ============================================
// Display Component Interfaces
// ============================================

export interface TableProps {
  headers: Array<{ literalString: string }>
  rows: Array<Array<unknown>>
}

export interface CardProps {
  title?: { literalString: string }
  content?: { literalString: string }
  children?: string[]
}

export interface TextProps {
  text: { literalString: string }
  style?: { literalString: 'default' | 'heading' | 'subheading' | 'caption' | 'code' }
}

export interface BadgeProps {
  text: { literalString: string }
  variant?: { literalString: 'info' | 'success' | 'warning' | 'error' }
}

export interface ProgressProps {
  value: { literalNumber: number }
  max?: { literalNumber: number }
  label?: { literalString: string }
}

export interface DividerProps {
  style?: { literalString: 'solid' | 'dashed' }
  direction?: { literalString: 'horizontal' | 'vertical' }
  label?: { literalString: string }
}

export interface ListProps {
  items: Array<Record<string, unknown>>
  listType?: { literalString: 'bullet' | 'numbered' | 'none' }
}

// ============================================
// Layout Component Interfaces
// ============================================

export interface RowProps {
  align?: { literalString: 'start' | 'center' | 'end' | 'stretch' }
  gap?: { literalString: 'none' | 'small' | 'medium' | 'large' }
  children: string[]
}

export interface ColumnProps {
  width?: { literalString: 'auto' | 'half' | 'third' | 'full' }
  align?: { literalString: 'start' | 'center' | 'end' | 'stretch' }
  children: string[]
}

// ============================================
// Event Payloads
// ============================================

export interface ValueChangePayload {
  id: string
  name: string
  value: unknown
}

export interface ClickPayload {
  id: string
}

// ============================================
// Component Registry Types
// ============================================

import type { Component } from 'vue'

/**
 * A2UI 组件注册表接口
 * 符合 OCP 原则：可以添加新组件而不修改现有代码
 */
export interface A2UIComponentRegistry {
  /**
   * 注册组件
   */
  register(
    type: string,
    component: Component
  ): void

  /**
   * 获取组件
   */
  get(type: string): Component | undefined

  /**
   * 检查组件是否存在
   */
  has(type: string): boolean

  /**
   * 获取所有已注册的组件类型
   */
  getRegisteredTypes(): string[]
}

/**
 * A2UI 组件工厂接口
 */
export interface A2UIComponentFactory {
  create(type: string, id: string, props: Record<string, unknown>): Component | null
}
