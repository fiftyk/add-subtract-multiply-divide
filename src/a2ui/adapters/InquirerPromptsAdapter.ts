/**
 * Inquirer Prompts Adapter
 *
 * Uses @inquirer/prompts for user input instead of the legacy inquirer library.
 * This provides better type safety, cleaner API, and easier extensibility.
 */

import { input, confirm, select, checkbox, number } from '@inquirer/prompts';
import type { SelectFieldProps, TextFieldProps } from '../types.js';

/**
 * Simplified props for confirm prompt (only needs label)
 */
export interface ConfirmProps {
  label: string;
}

/**
 * Simplified props for date prompt
 */
export interface DateInputProps {
  label: string;
  minDate?: string;
  maxDate?: string;
}

/**
 * Prompt adapter interface for A2UI input components
 */
export interface PromptAdapter {
  text(props: TextFieldProps): Promise<string>;
  number(props: TextFieldProps): Promise<number | undefined>;
  confirm(props: ConfirmProps): Promise<boolean>;
  date(props: DateInputProps): Promise<string>;
  select(props: SelectFieldProps): Promise<string | number>;
  multiSelect(props: SelectFieldProps): Promise<(string | number)[]>;
}

/**
 * Implementation using @inquirer/prompts
 */
export class InquirerPromptsAdapter implements PromptAdapter {
  async text(props: TextFieldProps): Promise<string> {
    return await input({
      message: props.label,
      default: props.placeholder,
      validate: (value) => {
        if (props.required && !value) {
          return 'This field is required';
        }
        return true;
      },
    });
  }

  async number(props: TextFieldProps): Promise<number | undefined> {
    const defaultValue = props.placeholder
      ? (() => {
          const parsed = parseFloat(props.placeholder);
          return isNaN(parsed) ? undefined : parsed;
        })()
      : undefined;
    return await number({
      message: props.label,
      default: defaultValue,
      required: false,
    });
  }

  async confirm(props: ConfirmProps): Promise<boolean> {
    return await confirm({
      message: props.label,
      default: true,
    });
  }

  async date(props: DateInputProps): Promise<string> {
    const today = new Date().toISOString().split('T')[0];

    return await input({
      message: props.label,
      default: today,
      validate: (value) => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return 'Please enter a valid date (YYYY-MM-DD)';
        }
        if (props.minDate && date < new Date(props.minDate)) {
          return `Date must be after ${props.minDate}`;
        }
        if (props.maxDate && date > new Date(props.maxDate)) {
          return `Date must be before ${props.maxDate}`;
        }
        return true;
      },
    });
  }

  async select(props: SelectFieldProps): Promise<string | number> {
    return await select({
      message: props.label,
      choices: props.options.map((opt) => ({
        name: opt.label,
        value: opt.value,
        description: opt.description,
      })),
    });
  }

  async multiSelect(props: SelectFieldProps): Promise<(string | number)[]> {
    return await checkbox({
      message: props.label,
      choices: props.options.map((opt) => ({
        name: opt.label,
        value: opt.value,
        description: opt.description,
      })),
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one option';
        }
        return true;
      },
    });
  }
}

/**
 * Singleton instance for convenience
 */
let adapterInstance: PromptAdapter | null = null;

export function getPromptAdapter(): PromptAdapter {
  if (!adapterInstance) {
    adapterInstance = new InquirerPromptsAdapter();
  }
  return adapterInstance;
}
