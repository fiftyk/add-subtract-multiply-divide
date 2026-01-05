/**
 * CLI Renderer - A2UI implementation for terminal
 * 
 * Renders A2UI components using chalk for styling
 * and inquirer for user input.
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import chalk from 'chalk';
import inquirer from 'inquirer';
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
  DateFieldProps,
  SelectFieldProps,
  RowProps,
  TableProps,
} from '../types.js';

interface Surface {
  rootId: string;
  components: Map<string, A2UIComponent>;
}

@injectable()
export class CLIRenderer implements A2UIRenderer {
  private surfaces = new Map<string, Surface>();
  private actionHandler?: (action: A2UIUserAction) => void;

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

    const [[type, props]] = Object.entries(comp.component);
    const p = props as unknown;

    switch (type) {
      case 'TextField': {
        const tfProps = p as TextFieldProps;
        const { value } = await inquirer.prompt([{
          type: tfProps.multiline ? 'editor' : 'input',
          name: 'value',
          message: tfProps.label,
          default: tfProps.placeholder,
        }]);
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [tfProps.name]: value },
        };
      }

      case 'Button': {
        const btnProps = p as ButtonProps;
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: btnProps.label,
          default: true,
        }]);
        return {
          name: confirmed ? btnProps.action : 'cancel',
          surfaceId,
          componentId,
        };
      }

      case 'DateField': {
        const dateProps = p as DateFieldProps;
        const { value } = await inquirer.prompt([{
          type: 'input',
          name: 'value',
          message: dateProps.label,
          default: new Date().toISOString().split('T')[0],
          validate: (input: string) => {
            const date = new Date(input);
            if (isNaN(date.getTime())) {
              return 'Please enter a valid date (YYYY-MM-DD)';
            }
            if (dateProps.minDate && date < new Date(dateProps.minDate)) {
              return `Date must be after ${dateProps.minDate}`;
            }
            if (dateProps.maxDate && date > new Date(dateProps.maxDate)) {
              return `Date must be before ${dateProps.maxDate}`;
            }
            return true;
          },
        }]);
        return {
          name: 'submit',
          surfaceId,
          componentId,
          payload: { [dateProps.name]: value },
        };
      }

      case 'SelectField': {
        const selectProps = p as SelectFieldProps;
        const inquirerType = selectProps.multiSelect ? 'checkbox' : 'list';
        const { value } = await inquirer.prompt([{
          type: inquirerType,
          name: 'value',
          message: selectProps.label,
          choices: selectProps.options.map(opt => ({
            name: opt.label,
            value: opt.value,
            short: opt.label,
          })),
        }]);
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

      case 'Table':
        this.renderTable(props as TableProps, pad);
        break;

      default:
        console.log(pad + chalk.yellow(`[Unknown: ${type}]`));
    }
  }

  private renderText(props: TextProps, pad: string): void {
    switch (props.style) {
      case 'heading':
        console.log(pad + chalk.bold.white(props.text));
        break;
      case 'subheading':
        console.log(pad + chalk.bold(props.text));
        break;
      case 'caption':
        console.log(pad + chalk.dim(props.text));
        break;
      case 'code':
        console.log(pad + chalk.cyan(props.text));
        break;
      default:
        console.log(pad + props.text);
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
    for (const childId of props.children) {
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

    for (const childId of props.children) {
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
    switch (props.style) {
      case 'heading':
        return [chalk.bold.white(props.text)];
      case 'subheading':
        return [chalk.bold(props.text)];
      case 'caption':
        return [chalk.dim(props.text)];
      case 'code':
        return [chalk.cyan(props.text)];
      default:
        return [props.text];
    }
  }

  private renderList(surface: Surface, props: ListProps, indent: number): void {
    const pad = '  '.repeat(indent);
    props.children.forEach((childId, index) => {
      const child = surface.components.get(childId);
      if (child) {
        const marker = props.ordered ? `${index + 1}.` : '•';
        process.stdout.write(pad + chalk.dim(marker) + ' ');
        this.renderComponent(surface, child, 0);
      }
    });
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
    const label = props.disabled
      ? chalk.dim(`[ ${props.label} ]`)
      : chalk.cyan(`[ ${props.label} ]`);
    console.log(pad + label);
  }

  private renderTable(props: TableProps, pad: string): void {
    if (props.headers.length === 0) return;

    // Calculate column widths
    const colWidths = props.headers.map((h, i) => {
      const maxRowLength = Math.max(
        h.length,
        ...props.rows.map(row => String(row[i] ?? '').length)
      );
      return maxRowLength + 2; // Add padding
    });

    // Helper to truncate/pad cell content
    const formatCell = (content: string | number | boolean | null, width: number): string => {
      const str = String(content ?? '');
      if (str.length > width - 2) {
        return ' ' + str.slice(0, width - 3) + '..';
      }
      return ' ' + str.padEnd(width - 1);
    };

    // Render header separator
    const separator = pad + colWidths.map(w => '─'.repeat(w)).join('─┼─');
    console.log(pad + '┌' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '┐');

    // Render header
    const headerLine = pad + '│' + props.headers.map((h, i) => formatCell(h, colWidths[i])).join('│') + '│';
    console.log(headerLine);

    // Render header-row separator
    console.log(separator);

    // Render rows
    for (const row of props.rows) {
      const rowLine = pad + '│' + row.map((cell, i) => formatCell(cell, colWidths[i])).join('│') + '│';
      console.log(rowLine);
    }

    // Render bottom separator
    console.log(pad + '└' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '┘');
  }
}
