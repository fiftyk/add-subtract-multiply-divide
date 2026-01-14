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

export interface TextFieldProps {
  label: TextValue
  name: { literalString: string }
  placeholder?: TextValue
  required?: BooleanValue
  multiline?: BooleanValue
  textFieldType?: { literalString: 'shortText' | 'longText' | 'number' | 'email' | 'password' }
  value?: TextValue
  disabled?: BooleanValue
}

export interface CheckBoxProps {
  label: TextValue
  checked?: BooleanValue
  disabled?: BooleanValue
}

export interface DateTimeInputProps {
  label: TextValue
  name: { literalString: string }
  mode?: { literalString: 'date' | 'time' | 'datetime-local' }
  value?: TextValue
  minDate?: TextValue
  maxDate?: TextValue
  required?: BooleanValue
  disabled?: BooleanValue
}

export interface MultipleChoiceProps {
  label: TextValue
  name: { literalString: string }
  options: Array<{ value: string; label: string }>
  selections?: { path: string } | { explicitList: Array<string> }
  optionLabel?: string
  optionValue?: string
  maxAllowedSelections?: NumberValue
  minAllowedSelections?: NumberValue
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

export interface ButtonProps {
  label: TextValue
  variant?: { literalString: 'primary' | 'secondary' | 'danger' | 'ghost' }
  disabled?: BooleanValue
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
