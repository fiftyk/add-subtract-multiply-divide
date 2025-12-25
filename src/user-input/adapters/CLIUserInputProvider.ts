/**
 * CLI 用户输入提供者（简化实现）
 *
 * 采用 JSON 输入模式：
 * 1. 打印字段说明和示例 JSON
 * 2. 用户输入完整的 JSON 对象
 * 3. 验证每个字段并返回结果
 *
 * 优势：
 * - 快速实现，无需复杂的 Schema → inquirer 转换
 * - 开发者友好，支持从文件粘贴 JSON
 * - 保持 A2UI Schema 接口，未来可升级为表单模式
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import inquirer from 'inquirer';
import type { UserInputProvider } from '../interfaces/UserInputProvider.js';
import type {
  A2UISchema,
  A2UIResult,
  A2UIField,
  SelectFieldConfig,
} from '../interfaces/A2UISchema.js';
import { validateUserInput } from '../validation/schema-validator.js';

@injectable()
export class CLIUserInputProvider implements UserInputProvider {
  /**
   * 所有字段类型都通过 JSON 输入支持
   */
  supportsFieldType(type: string): boolean {
    return ['text', 'number', 'boolean', 'single_select', 'multi_select'].includes(type);
  }

  /**
   * 请求用户输入（JSON 模式）
   */
  async requestInput(
    schema: A2UISchema,
    context?: Record<string, unknown>
  ): Promise<A2UIResult> {
    console.log('\n' + '='.repeat(50));
    console.log('  User Input Required');
    console.log('='.repeat(50) + '\n');

    // 打印字段说明
    console.log('Expected fields:');
    schema.fields.forEach((field) => {
      const req = field.required ? '(required)' : '(optional)';
      const desc = field.description || field.label;
      console.log(`  • ${field.id}: ${field.type} ${req}`);
      console.log(`    ${desc}`);
    });

    console.log('\n' + '-'.repeat(50));
    console.log('Please enter JSON object:');
    console.log('Example:');
    console.log(this.generateExample(schema));
    console.log('-'.repeat(50) + '\n');

    // 读取 JSON 输入
    const input = await this.readJsonInput();

    // 验证每个字段
    const values: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const value = input[field.id];
      const validation = validateUserInput(field, value);

      if (!validation.valid) {
        throw new Error(
          `Validation failed for field "${field.id}": ${validation.error}`
        );
      }

      values[field.id] = value;
    }

    console.log('\n✅ Input validated successfully\n');

    return {
      values,
      timestamp: Date.now(),
      skipped: false,
    };
  }

  /**
   * 读取 JSON 输入
   * 使用 inquirer 的 input 类型 (单行输入，适合 JSON)
   */
  private async readJsonInput(): Promise<Record<string, unknown>> {
    const { jsonInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'jsonInput',
        message: 'JSON:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'JSON input cannot be empty';
          }
          try {
            JSON.parse(input);
            return true;
          } catch (error) {
            return `Invalid JSON: ${(error as Error).message}`;
          }
        },
      },
    ]);

    return JSON.parse(jsonInput);
  }

  /**
   * 生成示例 JSON
   */
  private generateExample(schema: A2UISchema): string {
    const example: Record<string, unknown> = {};

    schema.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        example[field.id] = field.defaultValue;
      } else {
        // 生成示例值
        example[field.id] = this.generateExampleValue(field);
      }
    });

    return JSON.stringify(example, null, 2);
  }

  /**
   * 根据字段类型生成示例值
   */
  private generateExampleValue(field: A2UIField): unknown {
    switch (field.type) {
      case 'text':
        return 'example text';

      case 'number':
        // 考虑范围验证
        if (field.validation?.range) {
          const { min, max } = field.validation.range;
          if (min !== undefined) {
            return min;
          }
          if (max !== undefined) {
            return Math.max(0, max - 1);
          }
        }
        return 42;

      case 'boolean':
        return true;

      case 'single_select': {
        const config = field.config as SelectFieldConfig | undefined;
        return config?.options[0]?.value || 'option1';
      }

      case 'multi_select': {
        const config = field.config as SelectFieldConfig | undefined;
        const firstValue = config?.options[0]?.value || 'option1';
        return [firstValue];
      }

      default:
        return null;
    }
  }
}
