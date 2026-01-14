/**
 * A2UI Types - Agent to User Interface Protocol
 *
 * Based on Google A2UI v0.8 specification
 * https://github.com/google/A2UI
 */

// ================ BoundValue (A2UI Core) ================

/**
 * A2UI 绑定值 - 支持字面量和路径引用
 * 用于所有需要动态数据的属性
 *
 * A2UI v0.8 规范定义
 */
export type BoundValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { literalArray: unknown[] }
  | { path: string };

/** 文本值绑定 */
export type TextValue = { literalString: string } | { path: string };

/** 数字值绑定 */
export type NumberValue = { literalNumber: number } | { path: string };

/** 布尔值绑定 */
export type BooleanValue = { literalBoolean: boolean } | { path: string };

/** 数组值绑定 */
export type ArrayValue = { literalArray: unknown[] } | { path: string };

/** 子元素列表绑定 */
export type ChildrenValue =
  | { explicitList: string[] }
  | { path: string };

// ================ A2UI Schema (Form Input) ================

/**
 * A2UI Schema - describes a form for user input
 */
export interface A2UISchema {
  version: '1.0';
  fields: A2UIField[];
  config?: A2UISchemaConfig;
}

export interface A2UISchemaConfig {
  timeout?: number;
  skippable?: boolean;
}

export interface A2UIField {
  id: string;
  type: A2UIFieldType;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validation?: A2UIValidation;
  config?: A2UIFieldConfig;
}

export type A2UIFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'single_select'
  | 'multi_select';

export interface A2UIValidation {
  range?: { min?: number; max?: number };
  length?: { min?: number; max?: number };
  pattern?: string;
  errorMessage?: string;
}

export type A2UIFieldConfig = TextFieldInputConfig | SelectFieldConfig | DateFieldConfig;

export interface TextFieldInputConfig {
  multiline?: boolean;
  placeholder?: string;
}

export interface SelectFieldConfig {
  options: Array<{ value: string | number; label: string; description?: string }>;
  minSelections?: number;
  maxSelections?: number;
}

export interface DateFieldConfig {
  minDate?: string; // ISO date string
  maxDate?: string; // ISO date string
}

export interface A2UIResult {
  values: Record<string, unknown>;
  timestamp: number;
  skipped?: boolean;
}

// ================ Components ================

/**
 * A2UI Component - flat adjacency list model
 * Each component has an ID and a component definition
 */
export interface A2UIComponent {
  /** Unique identifier for this component */
  id: string;
  /** Component definition: { "ComponentType": { ...props } } */
  component: Record<string, ComponentProps>;
}

/** Component properties - varies by component type */
export type ComponentProps = Record<string, unknown>;

// ================ Server → Client Messages ================

export type A2UIServerMessage =
  | BeginRenderingMessage
  | SurfaceUpdateMessage
  | EndRenderingMessage
  | InputRequestedMessage
  | ConnectedMessage;

/** Initialize a new rendering surface */
export interface BeginRenderingMessage {
  type: 'beginRendering';
  surfaceId: string;
  root: string;
}

/** Update components on a surface */
export interface SurfaceUpdateMessage {
  type: 'surfaceUpdate';
  surfaceId: string;
  components: A2UIComponent[];
  removeComponentIds?: string[];
}

/** End rendering and cleanup */
export interface EndRenderingMessage {
  type: 'endRendering';
  surfaceId: string;
}

/** Input requested from user */
export interface InputRequestedMessage {
  type: 'inputRequested';
  surfaceId: string;
  componentId: string;
  requestId: string;
}

/** Client connected */
export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
}

// ================ Client → Server Messages ================

/** User action event sent from client to server */
export interface A2UIUserAction {
  /** Action name (e.g., 'click', 'submit', 'change') */
  name: string;
  /** Surface ID where the action occurred */
  surfaceId: string;
  /** Component ID that triggered the action */
  componentId: string;
  /** Action payload (form values, etc.) */
  payload?: Record<string, unknown>;
}

// ================ Built-in Component Types ================

/**
 * Standard component types supported by A2UI v0.8
 * Based on official specification
 */
export type StandardComponentType =
  | 'Text'
  | 'Card'
  | 'Row'
  | 'Column'
  | 'List'
  | 'Button'
  | 'TextField'
  | 'Progress'
  | 'Badge'
  | 'Divider'
  | 'MultipleChoice'
  | 'CheckBox'
  | 'DateTimeInput'
  | 'Slider'
  | 'Image'
  | 'Icon'
  | 'AudioPlayer'
  | 'Video'
  | 'Tabs'
  | 'Modal';

// ================ Component Props Definitions ================

/**
 * Text Component - 显示文本
 * A2UI v0.8: Text
 */
export interface TextProps {
  /** 文本内容（支持字面量或路径引用） */
  text: TextValue;
  /** 文本样式提示 */
  usageHint?: { literalString: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body' };
}

/**
 * Card Component - 卡片容器
 * A2UI v0.8: Card
 */
export interface CardProps {
  title?: string;
  content?: string;
  children?: string[];
}

/**
 * Row Component - 水平布局
 * A2UI v0.8: Row
 */
export interface RowProps {
  children: ChildrenValue;
  distribution?: { literalString: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly' };
  gap?: number;
}

/**
 * Column Component - 垂直布局
 * A2UI v0.8: Column
 */
export interface ColumnProps {
  children: ChildrenValue;
  distribution?: { literalString: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly' };
  gap?: number;
}

/**
 * List Component - 列表
 * A2UI v0.8: List
 */
export interface ListProps {
  children: ChildrenValue;
  direction?: { literalString: 'horizontal' | 'vertical' };
  ordered?: boolean;
}

/**
 * Button Component - 按钮
 * A2UI v0.8: Button
 */
export interface ButtonProps {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

/**
 * TextField Component - 文本输入
 * A2UI v0.8: TextField
 */
export interface TextFieldProps {
  /** 标签文本 */
  label: TextValue;
  /** 输入值绑定路径 */
  text: { path: string };
  /** 输入类型 */
  textFieldType?: { literalString: 'shortText' | 'longText' | 'number' | 'email' | 'password' };
  /** 占位符 */
  placeholder?: TextValue;
  /** 是否必填 */
  required?: BooleanValue;
}

/**
 * Progress Component - 进度条
 * A2UI v0.8: Progress
 */
export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
}

/**
 * Badge Component - 徽章
 * A2UI v0.8: Badge
 */
export interface BadgeProps {
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
}

/**
 * Divider Component - 分隔线
 * A2UI v0.8: Divider
 */
export interface DividerProps {
  style?: 'solid' | 'dashed';
}

/**
 * DateTimeInput Component - 日期时间输入
 * A2UI v0.8: DateTimeInput
 */
export interface DateTimeInputProps {
  label: TextValue;
  datetime: { path: string };
  enableDate?: BooleanValue;
  enableTime?: BooleanValue;
  minDatetime?: { literalString: string };
  maxDatetime?: { literalString: string };
}

/**
 * MultipleChoice Component - 多选组件
 * A2UI v0.8: MultipleChoice
 */
export interface MultipleChoiceProps {
  /** 标签文本 */
  label: TextValue;
  /** 用户选择绑定路径 */
  selections: { path: string };
  /** 选项列表（静态或动态） */
  options:
    | { path: string }
    | { explicitList: Array<{ label: string; value: string }> };
  /** 选项对象中用作标签的字段名 */
  optionLabel?: string;
  /** 选项对象中用作值的字段名 */
  optionValue?: string;
  /** 最大选择数量 */
  maxAllowedSelections?: NumberValue;
  /** 最小选择数量 */
  minAllowedSelections?: NumberValue;
}

/**
 * CheckBox Component - 复选框
 * A2UI v0.8: CheckBox
 */
export interface CheckBoxProps {
  label: TextValue;
  checked: BooleanValue;
}

/**
 * Slider Component - 滑块
 * A2UI v0.8: Slider
 */
export interface SliderProps {
  label: TextValue;
  value: NumberValue;
  minValue?: NumberValue;
  maxValue?: NumberValue;
}

// ================ Surface ================

/**
 * Surface Definition - A2UI v0.8 表面定义
 * 用于定义输入界面和结果展示界面
 */
export interface SurfaceDefinition {
  /** 表面标识符 */
  surfaceId: string;
  /** 根组件 ID */
  root: string;
  /** 组件列表（扁平邻接表） */
  components: A2UIComponent[];
}

/**
 * Surface - represents a rendering surface with components
 * Used by renderers to manage component state
 */
export interface Surface {
  /** Unique identifier for this surface */
  id: string;
  /** ID of the root component */
  rootId: string;
  /** Map of component ID to component definition */
  components: Map<string, A2UIComponent>;
  /** Rendering order of components */
  order: string[];
}

// ================ Execution Session Status ================

/**
 * Execution Session Status
 *
 * Represents the current state of an execution session.
 */
export type ExecutionStatus =
  | 'pending'    // Session created, not yet started
  | 'running'    // Actively executing steps
  | 'waiting_input' // Waiting for user input
  | 'completed'  // All steps completed successfully
  | 'failed';    // Execution failed

// ================ Execution Messages ================

/**
 * Execution message types for SSE streaming
 */
export type ExecutionMessageType =
  | 'connected'
  | 'executionStart'
  | 'stepStart'
  | 'stepComplete'
  | 'formRequest'
  | 'inputReceived'
  | 'executionComplete'
  | 'executionError';

/**
 * Base execution message
 */
export interface ExecutionMessage {
  type: ExecutionMessageType;
  sessionId: string;
  [key: string]: unknown;
}

/**
 * Form request message - sent when user input is required
 */
export interface FormRequestMessage extends ExecutionMessage {
  type: 'formRequest';
  surfaceId: string;
  stepId: number;
  schema: A2UISchema;
}

/**
 * Execution complete message
 */
export interface ExecutionCompleteMessage extends ExecutionMessage {
  type: 'executionComplete';
  success: boolean;
  result?: {
    planId: string;
    steps: Array<{
      stepId: number;
      type: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }>;
    finalResult?: unknown;
  };
}

