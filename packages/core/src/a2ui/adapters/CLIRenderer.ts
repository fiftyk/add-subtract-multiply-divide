/**
 * CLI Renderer - A2UI implementation for terminal
 *
 * Renders A2UI components using chalk for styling
 * and @inquirer/prompts for user input.
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import chalk from 'chalk';
import type { A2UIRenderer } from '../A2UIRenderer.js';
import type {
  A2UIComponent,
  A2UIUserAction,
  TextProps,
  CardProps,
  ListProps,
  ButtonProps,
  TextFieldProps,
  ProgressProps,
  BadgeProps,
  ColumnProps,
  DateTimeInputProps,
  MultipleChoiceProps,
  RowProps,
  TextValue,
  ChildrenValue,
} from '../types.js';
import { getPromptAdapter, type PromptAdapter, type ConfirmProps } from './InquirerPromptsAdapter.js';

interface Surface {
  rootId: string;
  components: Map<string, A2UIComponent>;
  /** Execution context for resolving BoundValue paths */
  context?: Record<string, unknown>;
}

/**
 * Extract text from a TextValue (resolves literalString, returns path for error)
 * Also handles plain strings for backward compatibility
 */
function getTextValue(value: TextValue | string): string {
  if (typeof value === 'string') return value;
  if ('literalString' in value) return value.literalString;
  return `[${value.path}]`;
}

/**
 * Extract children IDs from ChildrenValue
 */
function getChildrenIds(children: ChildrenValue, context: Record<string, unknown>): string[] {
  if ('explicitList' in children) return children.explicitList;
  return []; // Dynamic children require context resolution
}

@injectable()
export class CLIRenderer implements A2UIRenderer {
  private surfaces = new Map<string, Surface>();
  private actionHandler?: (action: A2UIUserAction) => void;
  private promptAdapter: PromptAdapter;

  constructor() {
    this.promptAdapter = getPromptAdapter();
  }

  begin(surfaceId: string, rootId: string): void {
    this.surfaces.set(surfaceId, {
      rootId,
      components: new Map(),
    });
  }

  update(surfaceId: string, components: A2UIComponent[]): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    for (const comp of components) {
      surface.components.set(comp.id, comp);
    }

    // Don't render immediately - wait for end() to render once
  }

  remove(surfaceId: string, componentIds: string[]): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    for (const id of componentIds) {
      surface.components.delete(id);
    }
  }

  end(surfaceId: string): void {
    // Only render if this is not a user-input surface
    // (user-input surfaces use inquirer for their own rendering)
    if (!surfaceId.startsWith('user-input-')) {
      this.renderSurface(surfaceId);
    }
    this.surfaces.delete(surfaceId);
  }

  onUserAction(handler: (action: A2UIUserAction) => void): void {
    this.actionHandler = handler;
  }

  async requestInput(surfaceId: string, componentId: string): Promise<A2UIUserAction> {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      throw new Error(`Surface not found: ${surfaceId}`);
    }

    const comp = surface.components.get(componentId);
    if (!comp) {
      throw new Error(`Component not found: ${componentId}`);
    }

    const [[type, rawProps]] = Object.entries(comp.component);
    const props = rawProps as unknown;

    switch (type) {
      case 'TextField': {
        const tfProps = props as TextFieldProps;
        const label = getTextValue(tfProps.label);
        const placeholder = tfProps.placeholder ? getTextValue(tfProps.placeholder) : undefined;
        const required = tfProps.required && 'literalBoolean' in tfProps.required ? tfProps.required.literalBoolean : false;
        // Use text.literalString for payload key (A2UI v0.8)
        const textProp = tfProps.text;
        let name = 'field';
        if (textProp && 'literalString' in textProp) {
          name = textProp.literalString;
        }

        const value = await this.promptAdapter.text({
          label,
          placeholder,
          required,
          name,
        });
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [name]: value },
        };
      }

      case 'Button': {
        const btnProps = props as ButtonProps;
        // A2UI v0.8: Button has child and action, not label
        const confirmed = await this.promptAdapter.confirm({ label: btnProps.child || 'Confirm' });
        const actionName = btnProps.action?.name || (confirmed ? 'confirm' : 'cancel');
        return {
          name: actionName,
          surfaceId,
          componentId,
        };
      }

      case 'DateTimeInput': {
        const dtProps = props as DateTimeInputProps;
        const label = dtProps.label ? getTextValue(dtProps.label) : 'Date/Time';
        // Use value.literalString for payload key (A2UI v0.8)
        const valueProp = dtProps.value;
        let name = 'datetime';
        if (valueProp && 'literalString' in valueProp) {
          name = valueProp.literalString;
        }

        const value = await this.promptAdapter.date({
          label,
          minDate: undefined,
          maxDate: undefined,
        });
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [name]: value },
        };
      }

      case 'MultipleChoice': {
        const mcProps = props as MultipleChoiceProps;
        const label = mcProps.label ? getTextValue(mcProps.label) : 'Select';
        // Use selections.literalArray for initial value, or component id for name
        const selections = mcProps.selections;
        let name = comp.id;
        if ('path' in selections) {
          const pathParts = selections.path.split('/').filter(p => p);
          name = pathParts[pathParts.length - 1];
        }

        // Build options from A2UI v0.8 format
        let options: Array<{ value: string | number; label: string }> = [];
        // A2UI v0.8: options is an array of {label: {...}, value: string}
        options = mcProps.options.map((opt) => {
          const optLabel = opt.label?.literalString || opt.value;
          return {
            value: opt.value,
            label: optLabel,
          };
        });

        const value = await this.promptAdapter.multiSelect({
          label,
          name,
          options,
        });
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [name]: value },
        };
      }

      // Legacy support for old component names
      case 'DateField': {
        const dateProps = props as { label: string; name: string; minDate?: string; maxDate?: string };
        const value = await this.promptAdapter.date({
          label: dateProps.label,
          minDate: dateProps.minDate,
          maxDate: dateProps.maxDate,
        });
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [dateProps.name]: value },
        };
      }

      case 'SelectField': {
        const selectProps = props as { label: string; name: string; options: Array<{ value: string | number; label: string }>; multiSelect?: boolean };
        const value = selectProps.multiSelect
          ? await this.promptAdapter.multiSelect({
              label: selectProps.label,
              name: selectProps.name,
              options: selectProps.options,
            })
          : await this.promptAdapter.select({
              label: selectProps.label,
              name: selectProps.name,
              options: selectProps.options,
            });
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [selectProps.name]: value },
        };
      }

      default:
        throw new Error(`Component type ${type} does not support input`);
    }
  }

  private renderSurface(surfaceId: string): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    console.log(''); // Empty line before surface

    // Try to render from root component first
    const root = surface.components.get(surface.rootId);
    if (root) {
      this.renderComponent(surface, root, 0);
    } else {
      // If no root component, render all top-level components
      for (const comp of surface.components.values()) {
        this.renderComponent(surface, comp, 0);
      }
    }

    console.log(''); // Empty line after surface
  }

  private renderComponent(surface: Surface, comp: A2UIComponent, indent: number): void {
    const [[type, rawProps]] = Object.entries(comp.component);
    const pad = '  '.repeat(indent);
    const props = rawProps as unknown;

    switch (type) {
      case 'Text':
        this.renderText(props as TextProps, pad);
        break;

      case 'Card':
        this.renderCard(surface, props as CardProps, indent);
        break;

      case 'Column':
        this.renderColumn(surface, props as ColumnProps, indent);
        break;

      case 'Row':
        this.renderRow(surface, props as RowProps, indent);
        break;

      case 'List':
        this.renderList(surface, props as ListProps, indent);
        break;

      case 'Progress':
        this.renderProgress(props as ProgressProps, pad);
        break;

      case 'Badge':
        this.renderBadge(props as BadgeProps, pad);
        break;

      case 'Button':
        this.renderButton(props as ButtonProps, pad);
        break;

      case 'Divider':
        console.log(pad + chalk.dim('─'.repeat(40)));
        break;

      default:
        console.log(pad + chalk.yellow(`[Unknown: ${type}]`));
    }
  }

  private renderText(props: TextProps, pad: string): void {
    const text = getTextValue(props.text);
    const usageHint = props.usageHint?.literalString;

    switch (usageHint) {
      case 'h1':
        console.log(pad + chalk.bold.whiteBright.underline(text));
        break;
      case 'h2':
        console.log(pad + chalk.bold.white(text));
        break;
      case 'h3':
        console.log(pad + chalk.bold(text));
        break;
      case 'h4':
        console.log(pad + chalk.bold.cyan(text));
        break;
      case 'h5':
        console.log(pad + chalk.cyan(text));
        break;
      case 'caption':
        console.log(pad + chalk.dim(text));
        break;
      case 'body':
      default:
        console.log(pad + text);
    }
  }

  private renderCard(surface: Surface, props: CardProps, indent: number): void {
    const pad = '  '.repeat(indent);
    console.log(pad + chalk.bgBlue.white(` ${props.title || 'Card'} `));
    
    if (props.children) {
      for (const childId of props.children) {
        const child = surface.components.get(childId);
        if (child) {
          this.renderComponent(surface, child, indent + 1);
        }
      }
    }
  }

  private renderColumn(surface: Surface, props: ColumnProps, indent: number): void {
    const childIds = getChildrenIds(props.children, surface.context || {});
    for (const childId of childIds) {
      const child = surface.components.get(childId);
      if (child) {
        this.renderComponent(surface, child, indent);
      }
    }
  }

  private renderRow(surface: Surface, props: RowProps, indent: number): void {
    const pad = '  '.repeat(indent);
    const gap = props.gap || 2;
    const renderedChildren: string[] = [];
    const childIds = getChildrenIds(props.children, surface.context || {});

    for (const childId of childIds) {
      const child = surface.components.get(childId);
      if (child) {
        // Capture the output of rendering each child
        const lines = this.captureRenderComponent(surface, child);
        renderedChildren.push(lines.join('\n'));
      }
    }

    // Render children on the same line separated by spaces
    console.log(pad + renderedChildren.join(' '.repeat(gap)));
  }

  private captureRenderComponent(surface: Surface, comp: A2UIComponent): string[] {
    const [[type, rawProps]] = Object.entries(comp.component);
    const props = rawProps as unknown;

    switch (type) {
      case 'Text':
        return this.captureText(props as TextProps);
      default:
        return [`[${type}]`];
    }
  }

  private captureText(props: TextProps): string[] {
    const text = getTextValue(props.text);
    const usageHint = props.usageHint?.literalString;

    switch (usageHint) {
      case 'h1':
        return [chalk.bold.whiteBright.underline(text)];
      case 'h2':
        return [chalk.bold.white(text)];
      case 'h3':
        return [chalk.bold(text)];
      case 'h4':
        return [chalk.bold.cyan(text)];
      case 'h5':
        return [chalk.cyan(text)];
      case 'caption':
        return [chalk.dim(text)];
      case 'body':
      default:
        return [text];
    }
  }

  private renderList(surface: Surface, props: ListProps, indent: number): void {
    const pad = '  '.repeat(indent);
    const childIds = getChildrenIds(props.children, surface.context || {});
    const direction = props.direction?.literalString;

    if (direction === 'horizontal') {
      // Horizontal list
      const items: string[] = [];
      for (const childId of childIds) {
        const child = surface.components.get(childId);
        if (child) {
          const lines = this.captureRenderComponent(surface, child);
          items.push(lines.join(' '));
        }
      }
      console.log(pad + items.join('  '));
    } else {
      // Vertical list (default)
      childIds.forEach((childId, index) => {
        const child = surface.components.get(childId);
        if (child) {
          const marker = props.ordered ? `${index + 1}.` : '•';
          process.stdout.write(pad + chalk.dim(marker) + ' ');
          this.renderComponent(surface, child, 0);
        }
      });
    }
  }

  private renderProgress(props: ProgressProps, pad: string): void {
    const max = props.max || 100;
    const percent = Math.min(100, Math.round((props.value / max) * 100));
    const filled = Math.round(percent / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const label = props.label ? `${props.label} ` : '';
    console.log(pad + `${label}[${chalk.green(bar)}] ${percent}%`);
  }

  private renderBadge(props: BadgeProps, pad: string): void {
    switch (props.variant) {
      case 'success':
        console.log(pad + chalk.bgGreen.black(` ✓ ${props.text} `));
        break;
      case 'warning':
        console.log(pad + chalk.bgYellow.black(` ⚠ ${props.text} `));
        break;
      case 'error':
        console.log(pad + chalk.bgRed.white(` ✗ ${props.text} `));
        break;
      default:
        console.log(pad + chalk.bgBlue.white(` ${props.text} `));
    }
  }

  private renderButton(props: ButtonProps, pad: string): void {
    // A2UI v0.8: Button uses 'child' for the button label text
    const labelText = props.child || 'Button';
    const label = props.disabled
      ? chalk.dim(`[ ${labelText} ]`)
      : chalk.cyan(`[ ${labelText} ]`);
    console.log(pad + label);
  }
}
