/**
 * Form Input Schema - 用户输入的结构化描述
 *
 * 该协议定义了 AI 系统如何以结构化方式描述表单输入需求
 * 支持多种环境 (CLI, Web, Mobile) 的用户输入收集
 *
 * 注意：这是本项目自定义的表单输入协议，与 Google 的 A2UI (Agent-to-UI) 渲染协议无关
 */

/**
 * Form Input Schema 核心接口
 */
export interface FormInputSchema {
  /** Schema 版本 */
  version: '1.0';

  /** 输入字段定义 */
  fields: FormInputField[];

  /** 全局配置(可选) */
  config?: FormInputSchemaConfig;
}

/**
 * Schema 全局配置
 */
export interface FormInputSchemaConfig {
  /** 超时时间(毫秒),默认无限制 */
  timeout?: number;

  /** 是否允许跳过 */
  skippable?: boolean;
}

/**
 * 单个输入字段定义
 */
export interface FormInputField {
  /** 字段唯一标识 */
  id: string;

  /** 字段类型 */
  type: FormInputFieldType;

  /** 显示标签 */
  label: string;

  /** 帮助文本(可选) */
  description?: string;

  /** 是否必填 */
  required?: boolean;

  /** 默认值 */
  defaultValue?: unknown;

  /** 验证规则 */
  validation?: FormInputValidation;

  /** 类型特定配置 */
  config?: FormInputFieldConfig;

  /** 条件显示规则(可选,阶段4实现) */
  condition?: FormInputCondition;
}

/**
 * 支持的字段类型
 */
export type FormInputFieldType =
  | 'text'           // 单行文本
  | 'number'         // 数字
  | 'boolean'        // 是/否
  | 'date'           // 日期
  | 'single_select'  // 单选
  | 'multi_select';  // 多选

/**
 * 验证规则
 */
export interface FormInputValidation {
  /** 数字范围 */
  range?: {
    min?: number;
    max?: number;
  };

  /** 字符串长度 */
  length?: {
    min?: number;
    max?: number;
  };

  /** 正则表达式 */
  pattern?: string;

  /** 自定义错误消息 */
  errorMessage?: string;
}

/**
 * 字段特定配置
 */
export type FormInputFieldConfig =
  | TextFieldConfig
  | SelectFieldConfig;

/**
 * 文本字段配置
 */
export interface TextFieldConfig {
  /** 是否多行 */
  multiline?: boolean;

  /** 占位符 */
  placeholder?: string;
}

/**
 * 选择字段配置
 */
export interface SelectFieldConfig {
  /** 选项列表 */
  options: Array<{
    value: string | number;
    label: string;
    description?: string;
  }>;

  /** 多选时的最小选择数 */
  minSelections?: number;

  /** 多选时的最大选择数 */
  maxSelections?: number;
}

/**
 * 条件显示规则(阶段4)
 */
export interface FormInputCondition {
  /** 依赖的字段 ID */
  dependsOn: string;

  /** 条件操作符 */
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';

  /** 期望值 */
  value: unknown;
}

/**
 * 用户输入结果
 */
export interface FormInputResult {
  /** 字段 ID → 用户输入值 */
  values: Record<string, unknown>;

  /** 输入时间戳 */
  timestamp: number;

  /** 是否被跳过 */
  skipped?: boolean;
}
