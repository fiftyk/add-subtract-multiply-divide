/**
 * 组件类型定义
 *
 * A2UI 使用邻接表模型：扁平列表 + ID 引用
 */

import type { BoundValue } from './BoundValue.js';

/**
 * A2UI 组件
 */
export interface Component {
  /** 组件唯一标识 */
  id: string;

  /** 组件类型包装器（一个组件只有一个类型） */
  component: Record<string, ComponentProperties>;

  /** 子组件引用（可选） */
  children?: ChildrenConfig;
}

/**
 * 组件属性
 */
export interface ComponentProperties {
  /** 文本内容 */
  text?: BoundValue<string>;

  /** 占位符 */
  placeholder?: BoundValue<string>;

  /** 值 */
  value?: BoundValue<unknown>;

  /** 禁用状态 */
  disabled?: BoundValue<boolean>;

  /** 可见性 */
  visible?: BoundValue<boolean>;

  /** 标签 */
  label?: BoundValue<string>;

  /** 选项列表（用于 Select 等） */
  options?: SelectOption[];

  /** 样式 */
  style?: BoundValue<string>;

  /** 其他属性 */
  [key: string]: unknown;
}

/**
 * 选择框选项
 */
export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
}

/**
 * 子组件配置
 */
export interface ChildrenConfig {
  /** 静态子组件列表 */
  explicitList?: string[];

  /** 动态模板 */
  template?: TemplateConfig;
}

/**
 * 模板配置
 */
export interface TemplateConfig {
  /** 数据绑定路径，如 "/user/posts" */
  dataBinding: string;

  /** 模板组件 ID */
  componentId: string;
}

/**
 * 容器组件（方便类型检查）
 */
export interface ContainerComponent extends ComponentProperties {
  children: ChildrenConfig;
}

/**
 * 输入组件（方便类型检查）
 */
export interface InputComponent extends ComponentProperties {
  onChange?: string;  // 动作名称
  validation?: ValidationConfig;
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

/**
 * 按钮组件
 */
export interface ButtonComponent extends ComponentProperties {
  onClick?: string;  // 动作名称
}

/**
 * 常见组件类型
 */
export type ComponentType =
  | 'Text'
  | 'TextInput'
  | 'NumberInput'
  | 'Button'
  | 'Select'
  | 'MultiSelect'
  | 'Checkbox'
  | 'Card'
  | 'Column'
  | 'Row'
  | 'Form'
  | 'List';
