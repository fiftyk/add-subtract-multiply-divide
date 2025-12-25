/**
 * A2UI Schema 验证器
 *
 * 使用 Zod 进行 Schema 结构验证和用户输入验证
 */

import { z } from 'zod';
import type {
  A2UISchema,
  A2UIField,
  A2UIFieldType,
  SelectFieldConfig,
} from '../interfaces/A2UISchema.js';

/**
 * 字段验证 Schema
 */
const FieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  type: z.enum(['text', 'number', 'boolean', 'single_select', 'multi_select'], {
    message: 'Invalid field type',
  }),
  label: z.string().min(1, 'Field label is required'),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      range: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
        })
        .optional(),
      length: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
        })
        .optional(),
      pattern: z.string().optional(),
      errorMessage: z.string().optional(),
    })
    .optional(),
  config: z.any().optional(),
  condition: z
    .object({
      dependsOn: z.string(),
      operator: z.enum(['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan']),
      value: z.unknown(),
    })
    .optional(),
});

/**
 * A2UI Schema 验证器
 */
const A2UISchemaValidator = z.object({
  version: z.literal('1.0'),
  fields: z.array(FieldSchema).min(1, 'At least one field is required'),
  config: z
    .object({
      timeout: z.number().positive('Timeout must be positive').optional(),
      skippable: z.boolean().optional(),
    })
    .optional(),
});

/**
 * 验证 A2UI Schema 结构
 *
 * @param schema 待验证的 Schema
 * @returns 验证通过的 Schema
 * @throws {z.ZodError} Schema 格式错误
 */
export function validateA2UISchema(schema: unknown): A2UISchema {
  return A2UISchemaValidator.parse(schema);
}

/**
 * 验证用户输入
 *
 * @param field 字段定义
 * @param value 用户输入值
 * @returns 验证结果
 */
export function validateUserInput(
  field: A2UIField,
  value: unknown
): { valid: boolean; error?: string } {
  // 必填检查
  if (field.required && (value === undefined || value === null || value === '')) {
    return {
      valid: false,
      error: `${field.label} is required`,
    };
  }

  // 如果值为空但非必填，跳过后续验证
  if (value === undefined || value === null || value === '') {
    return { valid: true };
  }

  // 类型检查和验证规则
  switch (field.type) {
    case 'number':
      return validateNumber(field, value);

    case 'text':
      return validateText(field, value);

    case 'boolean':
      return validateBoolean(field, value);

    case 'single_select':
      return validateSingleSelect(field, value);

    case 'multi_select':
      return validateMultiSelect(field, value);

    default:
      return {
        valid: false,
        error: `Unsupported field type: ${field.type}`,
      };
  }
}

/**
 * 验证数字类型
 */
function validateNumber(field: A2UIField, value: unknown): { valid: boolean; error?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      valid: false,
      error: `${field.label} must be a number`,
    };
  }

  // 范围验证
  if (field.validation?.range) {
    const { min, max } = field.validation.range;

    if (min !== undefined && value < min) {
      return {
        valid: false,
        error: field.validation.errorMessage || `Value must be >= ${min}`,
      };
    }

    if (max !== undefined && value > max) {
      return {
        valid: false,
        error: field.validation.errorMessage || `Value must be <= ${max}`,
      };
    }
  }

  return { valid: true };
}

/**
 * 验证文本类型
 */
function validateText(field: A2UIField, value: unknown): { valid: boolean; error?: string } {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${field.label} must be a string`,
    };
  }

  // 长度验证
  if (field.validation?.length) {
    const { min, max } = field.validation.length;

    if (min !== undefined && value.length < min) {
      return {
        valid: false,
        error: field.validation.errorMessage || `Minimum length is ${min}`,
      };
    }

    if (max !== undefined && value.length > max) {
      return {
        valid: false,
        error: field.validation.errorMessage || `Maximum length is ${max}`,
      };
    }
  }

  // 正则验证
  if (field.validation?.pattern) {
    try {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        return {
          valid: false,
          error: field.validation.errorMessage || 'Invalid format',
        };
      }
    } catch (error) {
      // 正则表达式格式错误
      return {
        valid: false,
        error: 'Invalid pattern configuration',
      };
    }
  }

  return { valid: true };
}

/**
 * 验证布尔类型
 */
function validateBoolean(field: A2UIField, value: unknown): { valid: boolean; error?: string } {
  if (typeof value !== 'boolean') {
    return {
      valid: false,
      error: `${field.label} must be true or false`,
    };
  }

  return { valid: true };
}

/**
 * 验证单选类型
 */
function validateSingleSelect(
  field: A2UIField,
  value: unknown
): { valid: boolean; error?: string } {
  const config = field.config as SelectFieldConfig | undefined;

  if (!config?.options) {
    return {
      valid: false,
      error: 'Select field must have options',
    };
  }

  const validValues = config.options.map((opt) => opt.value);
  if (!validValues.includes(value as string | number)) {
    return {
      valid: false,
      error: 'Invalid selection',
    };
  }

  return { valid: true };
}

/**
 * 验证多选类型
 */
function validateMultiSelect(
  field: A2UIField,
  value: unknown
): { valid: boolean; error?: string } {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: 'Must be an array',
    };
  }

  const config = field.config as SelectFieldConfig | undefined;

  if (!config?.options) {
    return {
      valid: false,
      error: 'Multi-select field must have options',
    };
  }

  // 检查最小/最大选择数
  if (config.minSelections !== undefined && value.length < config.minSelections) {
    return {
      valid: false,
      error: `Select at least ${config.minSelections} option(s)`,
    };
  }

  if (config.maxSelections !== undefined && value.length > config.maxSelections) {
    return {
      valid: false,
      error: `Select at most ${config.maxSelections} option(s)`,
    };
  }

  // 检查所有值是否有效
  const validValues = config.options.map((opt) => opt.value);
  for (const item of value) {
    if (!validValues.includes(item as string | number)) {
      return {
        valid: false,
        error: `Invalid selection: ${item}`,
      };
    }
  }

  return { valid: true };
}
