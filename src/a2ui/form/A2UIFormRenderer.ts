/**
 * A2UI Form Renderer
 *
 * 将 FormInputSchema 转换为 A2UI 组件
 * 支持通过 A2UI 协议渲染表单界面
 */

import type { FormInputSchema, FormInputField } from '../../user-input/interfaces/FormInputSchema.js';
import type { Component } from '../interfaces/Component.js';

/**
 * 扩展的表单配置（包含 A2UI 特定配置）
 */
interface ExtendedFormConfig {
  title?: string;
  submitLabel?: string;
  [key: string]: unknown;
}

/**
 * A2UI Form Renderer
 *
 * 将 FormInputSchema 转换为 A2UI 组件数组
 */
export class A2UIFormRenderer {
  /**
   * 将 FormInputSchema 渲染为 A2UI 组件
   *
   * @param schema Form Input Schema
   * @param formId 表单 ID (默认 'form')
   * @param submitAction 提交动作名称 (默认 'submit')
   * @returns A2UI 组件数组
   */
  render(schema: FormInputSchema, formId: string = 'form', submitAction: string = 'submit'): Component[] {
    const config = schema.config as ExtendedFormConfig | undefined;
    const components: Component[] = [];

    // 表单标题
    if (config?.title) {
      components.push({
        id: `${formId}-title`,
        component: {
          Text: {
            text: { literalString: config.title },
          },
        },
      });
    }

    // 渲染每个字段
    for (const field of schema.fields) {
      const fieldComponent = this.renderField(field, formId, submitAction);
      if (fieldComponent) {
        components.push(fieldComponent);
      }
    }

    // 提交按钮
    components.push({
      id: `${formId}-submit`,
      component: {
        Button: {
          label: { literalString: config?.submitLabel || '提交' },
          onClick: { literalString: submitAction },
        },
      },
    });

    return components;
  }

  /**
   * 渲染单个字段
   */
  private renderField(field: FormInputField, formId: string, _submitAction: string): Component | null {
    const fieldId = `${formId}-field-${field.id}`;
    const fieldContainerId = `${formId}-container-${field.id}`;

    // 字段标签
    const components: Component[] = [];

    // 根据字段类型选择组件
    switch (field.type) {
      case 'text':
        components.push(this.renderTextField(field, fieldId));
        break;

      case 'number':
        components.push(this.renderNumberField(field, fieldId));
        break;

      case 'boolean':
        components.push(this.renderBooleanField(field, fieldId));
        break;

      case 'date':
        components.push(this.renderDateField(field, fieldId));
        break;

      case 'single_select':
        components.push(this.renderSelectField(field, fieldId));
        break;

      case 'multi_select':
        components.push(this.renderMultiSelectField(field, fieldId));
        break;

      default:
        // 默认文本输入
        components.push(this.renderTextField(field, fieldId));
    }

    // 用 Column 包裹标签和输入组件
    return {
      id: fieldContainerId,
      component: {
        Column: {
          children: [
            // 标签
            {
              id: `${fieldId}-label`,
              component: {
                Text: {
                  text: { literalString: field.label + (field.required ? ' *' : '') },
                },
              },
            },
            // 输入组件
            ...components,
          ],
        },
      },
    };
  }

  /**
   * 渲染文本字段
   */
  private renderTextField(field: FormInputField, fieldId: string): Component {
    const textConfig = field.config as { placeholder?: string; multiline?: boolean } | undefined;
    return {
      id: fieldId,
      component: {
        TextInput: {
          placeholder: { literalString: textConfig?.placeholder || field.description || '' },
          value: field.defaultValue ? { literalString: String(field.defaultValue) } : undefined,
        },
      },
    };
  }

  /**
   * 渲染数字字段
   */
  private renderNumberField(field: FormInputField, fieldId: string): Component {
    return {
      id: fieldId,
      component: {
        TextInput: {
          placeholder: { literalString: field.description || '请输入数字' },
          value: field.defaultValue !== undefined ? { literalString: String(field.defaultValue) } : undefined,
        },
      },
    };
  }

  /**
   * 渲染布尔字段
   */
  private renderBooleanField(field: FormInputField, fieldId: string): Component {
    return {
      id: fieldId,
      component: {
        Button: {
          label: { literalString: field.defaultValue ? '是' : '否' },
          onClick: { literalString: `toggle-${fieldId}` },
        },
      },
    };
  }

  /**
   * 渲染日期字段
   */
  private renderDateField(field: FormInputField, fieldId: string): Component {
    return {
      id: fieldId,
      component: {
        TextInput: {
          placeholder: { literalString: field.description || 'YYYY-MM-DD' },
          value: field.defaultValue ? { literalString: String(field.defaultValue) } : undefined,
        },
      },
    };
  }

  /**
   * 渲染单选字段
   */
  private renderSelectField(field: FormInputField, fieldId: string): Component {
    const selectConfig = field.config as { options?: Array<{ value: string | number; label: string }> } | undefined;
    const options = selectConfig?.options || [];

    return {
      id: fieldId,
      component: {
        Select: {
          options: options.map((opt) => ({
            value: opt.value,
            label: opt.label,
          })),
          selectedValue: field.defaultValue !== undefined ? { literalString: String(field.defaultValue) } : undefined,
        },
      },
    };
  }

  /**
   * 渲染多选字段
   */
  private renderMultiSelectField(field: FormInputField, fieldId: string): Component {
    const selectConfig = field.config as { options?: Array<{ value: string | number; label: string }> } | undefined;
    const options = selectConfig?.options || [];

    // 多选使用 Column 包裹多个 Button
    return {
      id: fieldId,
      component: {
        Column: {
          children: options.map((opt, index) => ({
            id: `${fieldId}-option-${index}`,
            component: {
              Button: {
                label: { literalString: opt.label },
                onClick: { literalString: `toggle-${fieldId}-${index}` },
              },
            },
          })),
        },
      },
    };
  }

  /**
   * 提取表单数据绑定的路径
   */
  getDataBindingPath(formId: string, fieldId: string): string {
    return `${formId}.values.${fieldId}`;
  }
}
