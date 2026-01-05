/**
 * A2UI Types - Agent to User Interface Protocol
 * 
 * Based on Google A2UI v0.8 specification
 * https://github.com/google/A2UI
 */

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
  | EndRenderingMessage;

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
 * Standard component types supported by A2UI
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
  | 'Divider';

// ================ Component Props Definitions ================

export interface TextProps {
  text: string;
  style?: 'default' | 'heading' | 'subheading' | 'caption' | 'code';
}

export interface CardProps {
  title?: string;
  children?: string[];
}

export interface RowProps {
  children: string[];
  gap?: number;
}

export interface ColumnProps {
  children: string[];
  gap?: number;
}

export interface ListProps {
  children: string[];
  ordered?: boolean;
}

export interface ButtonProps {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface TextFieldProps {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
}

export interface BadgeProps {
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
}

export interface DividerProps {
  style?: 'solid' | 'dashed';
}

export interface DateFieldProps {
  label: string;
  name: string;
  minDate?: string;
  maxDate?: string;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  options: Array<{ value: string | number; label: string; description?: string }>;
  multiSelect?: boolean;
}
