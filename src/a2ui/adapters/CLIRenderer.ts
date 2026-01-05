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

    // Re-render surface from root
    this.renderSurface(surfaceId);
  }

  remove(surfaceId: string, componentIds: string[]): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    for (const id of componentIds) {
      surface.components.delete(id);
    }
  }

  end(surfaceId: string): void {
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

      default:
        throw new Error(`Component type ${type} does not support input`);
    }
  }

  private renderSurface(surfaceId: string): void {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return;

    const root = surface.components.get(surface.rootId);
    if (!root) return;

    console.log(''); // Empty line before surface
    this.renderComponent(surface, root, 0);
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
}
