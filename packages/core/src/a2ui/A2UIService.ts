/**
 * A2UI Service - High-level API for CLI/Web rendering
 *
 * Provides a simplified interface for business logic to emit A2UI messages
 * without knowing about specific renderers.
 */

import { v4 as uuidv4 } from 'uuid';
import type { A2UIRenderer as A2UIRendererType } from './A2UIRenderer.js';
import type { A2UIComponent, BoundValue, TextValue, NumberValue, BooleanValue, ChildrenValue, A2UISchema, A2UIField, SurfaceDefinition, MultipleChoiceProps } from './types.js';
import type { UserInputStep } from '../planner/types.js';

/**
 * Resolve a BoundValue to an actual value
 *
 * @param boundValue - BoundValue object (literal or path reference)
 * @param context - Data context for resolving path references
 * @returns Resolved actual value
 */
export function resolveBoundValue(
  boundValue: BoundValue | undefined,
  context: Record<string, unknown>
): unknown {
  if (!boundValue) return undefined;
  if ('literalString' in boundValue) return boundValue.literalString;
  if ('literalNumber' in boundValue) return boundValue.literalNumber;
  if ('literalBoolean' in boundValue) return boundValue.literalBoolean;
  if ('literalArray' in boundValue) return boundValue.literalArray;
  if ('path' in boundValue) {
    return resolvePath(boundValue.path, context);
  }
  return undefined;
}

/**
 * Resolve a path reference to a value in the context
 *
 * @param path - Path string (e.g., "/step1/input/keyword")
 * @param context - Data context object
 * @returns Resolved value or undefined if path not found
 */
export function resolvePath(path: string, context: Record<string, unknown>): unknown {
  if (!path || !path.startsWith('/')) return undefined;

  const parts = path.split('/').filter(p => p);
  let current: unknown = context;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Check if a value is a BoundValue literal type
 */
export function isLiteralValue(value: BoundValue): value is { literalString: string } | { literalNumber: number } | { literalBoolean: boolean } {
  return 'literalString' in value || 'literalNumber' in value || 'literalBoolean' in value;
}

/**
 * Get the literal value from a BoundValue (assumes it is a literal)
 */
export function getLiteralValue<T extends string | number | boolean>(value: BoundValue): T | undefined {
  if ('literalString' in value) return value.literalString as T;
  if ('literalNumber' in value) return value.literalNumber as T;
  if ('literalBoolean' in value) return value.literalBoolean as T;
  return undefined;
}

/**
 * High-level A2UI service for business logic
 */
export class A2UIService {
  private currentSurfaceId: string | null = null;
  private componentCounter = 0;

  constructor(private renderer: A2UIRendererType) {}

  /**
   * Start a new surface (e.g., a new screen/page)
   */
  startSurface(name?: string): string {
    const surfaceId = name || `surface-${uuidv4().slice(0, 8)}`;
    this.currentSurfaceId = surfaceId;
    this.componentCounter = 0;
    this.renderer.begin(surfaceId, 'root');
    return surfaceId;
  }

  /**
   * End the current surface
   */
  endSurface(): void {
    if (this.currentSurfaceId) {
      this.renderer.end(this.currentSurfaceId);
      this.currentSurfaceId = null;
    }
  }

  /**
   * Generate a unique component ID
   */
  private nextId(prefix = 'comp'): string {
    return `${prefix}-${this.componentCounter++}`;
  }

  // ========== Convenience Methods ==========

  /**
   * Display a text message
   */
  text(text: string, style?: 'default' | 'heading' | 'subheading' | 'caption' | 'code'): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }
    
    const id = this.nextId('text');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { Text: { text, style } } }
    ]);
  }

  /**
   * Display a heading
   */
  heading(text: string): void {
    this.text(text, 'heading');
  }

  /**
   * Display a caption/gray text
   */
  caption(text: string): void {
    this.text(text, 'caption');
  }

  /**
   * Display a code block
   */
  code(text: string): void {
    this.text(text, 'code');
  }

  /**
   * Display a badge (status indicator)
   */
  badge(text: string, variant?: 'success' | 'warning' | 'error' | 'info'): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('badge');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { Badge: { text, variant } } }
    ]);
  }

  /**
   * Display a progress bar
   */
  progress(value: number, label?: string): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('progress');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { Progress: { value, label } } }
    ]);
  }

  /**
   * Display a divider
   */
  divider(): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('divider');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { Divider: {} } }
    ]);
  }

  /**
   * Display a card with title and content
   */
  card(title: string, children: A2UIComponent[]): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const cardId = this.nextId('card');
    const childIds = children.map((c) => c.id);
    
    this.renderer.update(this.currentSurfaceId!, [
      { id: cardId, component: { Card: { title, children: childIds } } },
      ...children,
    ]);
  }

  /**
   * Display a list of items
   */
  list(items: string[], ordered = false): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const listId = this.nextId('list');
    const childIds: string[] = [];
    const children: A2UIComponent[] = [];

    for (const item of items) {
      const id = this.nextId('list-item');
      childIds.push(id);
      children.push({ id, component: { Text: { text: item } } });
    }

    this.renderer.update(this.currentSurfaceId!, [
      { id: listId, component: { List: { children: childIds, ordered } } },
      ...children,
    ]);
  }

  /**
   * Request user input (blocking)
   */
  async input(label: string, name: string): Promise<string> {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('input');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { TextField: { label, name } } }
    ]);

    const action = await this.renderer.requestInput(this.currentSurfaceId!, id);
    return (action.payload?.[name] as string) || '';
  }

  /**
   * Request user confirmation (blocking)
   */
  async confirm(message: string): Promise<boolean> {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('confirm');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { Button: { label: message, action: 'confirm' } } }
    ]);

    const action = await this.renderer.requestInput(this.currentSurfaceId!, id);
    return action.name === 'confirm';
  }

  /**
   * Request date input (blocking)
   */
  async date(label: string, name: string, minDate?: string, maxDate?: string): Promise<string> {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('date');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { DateField: { label, name, minDate, maxDate } } }
    ]);

    const action = await this.renderer.requestInput(this.currentSurfaceId!, id);
    return (action.payload?.[name] as string) || '';
  }

  /**
   * Request single select input (blocking)
   */
  async select(
    label: string,
    name: string,
    options: Array<{ value: string | number; label: string; description?: string }>
  ): Promise<string | number> {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('select');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { SelectField: { label, name, options, multiSelect: false } } }
    ]);

    const action = await this.renderer.requestInput(this.currentSurfaceId!, id);
    return action.payload?.[name] as string | number;
  }

  /**
   * Request multi-select input (blocking)
   */
  async multiSelect(
    label: string,
    name: string,
    options: Array<{ value: string | number; label: string; description?: string }>
  ): Promise<(string | number)[]> {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const id = this.nextId('multiselect');
    this.renderer.update(this.currentSurfaceId!, [
      { id, component: { SelectField: { label, name, options, multiSelect: true } } }
    ]);

    const action = await this.renderer.requestInput(this.currentSurfaceId!, id);
    return (action.payload?.[name] as (string | number)[]) || [];
  }

  /**
   * Display children in a row (horizontal layout)
   */
  row(children: A2UIComponent[], gap?: number): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const rowId = this.nextId('row');
    const childIds = children.map((c) => c.id);

    this.renderer.update(this.currentSurfaceId!, [
      { id: rowId, component: { Row: { children: childIds, gap } } },
      ...children,
    ]);
  }

  /**
   * Display children in a column (vertical layout)
   */
  column(children: A2UIComponent[], gap?: number): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const colId = this.nextId('column');
    const childIds = children.map((c) => c.id);

    this.renderer.update(this.currentSurfaceId!, [
      { id: colId, component: { Column: { children: childIds, gap } } },
      ...children,
    ]);
  }

  /**
   * Display a table with headers and rows
   */
  table(headers: string[], rows: Array<Array<string | number | boolean | null>>): void {
    if (!this.currentSurfaceId) {
      this.startSurface();
    }

    const tableId = this.nextId('table');
    this.renderer.update(this.currentSurfaceId!, [
      { id: tableId, component: { Table: { headers, rows } } },
    ]);
  }
}

/**
 * Build a schema with resolved options from inputUI
 *
 * Takes a UserInputStep with inputUI and resolves dynamic options
 * (e.g., MultipleChoice with options.path) using the provided context.
 * This is needed for web UIs that can't resolve paths dynamically.
 *
 * @param step - The user input step with inputUI
 * @param context - The execution context containing step results
 * @returns A2UISchema with resolved options for multi_select/single_select fields
 */
export function buildSchemaFromInputUI(
  step: UserInputStep,
  context: Record<string, unknown>
): A2UISchema {
  const fields: A2UIField[] = [];

  if (!step.inputUI) {
    // No inputUI, return schema as-is or empty schema
    return step.schema || { version: '1.0', fields: [] };
  }

  const ui = step.inputUI;

  // Process each component to find input fields
  for (const comp of ui.components) {
    const [[type, props]] = Object.entries(comp.component);

    if (type === 'TextField') {
      const tfProps = props as {
        label: { literalString: string } | { path: string };
        text: { path: string };
        required?: { literalBoolean: boolean } | { path: string };
      };

      // Resolve label
      const label = resolveBoundValue(tfProps.label, context) as string || '';

      // Resolve path to get field name
      const pathParts = tfProps.text.path.split('/').filter(p => p);
      const fieldId = pathParts[pathParts.length - 1];

      // Resolve required
      let required = false;
      if (tfProps.required && typeof tfProps.required === 'object' && 'literalBoolean' in tfProps.required) {
        required = (tfProps.required as { literalBoolean: boolean }).literalBoolean;
      }

      fields.push({
        id: fieldId,
        type: 'text',
        label,
        required,
      });
    }

    if (type === 'MultipleChoice') {
      const mcProps = props as unknown as MultipleChoiceProps;

      // Resolve label
      const label = resolveBoundValue(mcProps.label, context) as string || '';

      // Resolve path to get field name
      const pathParts = mcProps.selections.path.split('/').filter(p => p);
      const fieldId = pathParts[pathParts.length - 1];

      // Resolve options
      let options: Array<{ value: string | number; label: string; description?: string }> = [];

      if ('explicitList' in mcProps.options) {
        // Static options - transform to schema format
        options = mcProps.options.explicitList.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }));
      } else if ('path' in mcProps.options) {
        // Dynamic options - resolve from context
        const resolvedOptions = resolvePath(mcProps.options.path, context) as unknown[] | undefined;
        if (resolvedOptions && Array.isArray(resolvedOptions)) {
          const optionLabel = mcProps.optionLabel || 'label';
          const optionValue = mcProps.optionValue || 'value';

          options = resolvedOptions.map((opt) => {
            const optObj = opt as Record<string, unknown>;
            return {
              value: (optObj[optionValue] as string | number) || String(optObj[optionValue]),
              label: String(optObj[optionLabel] || optObj[optionValue] || ''),
            };
          });
        }
      }

      fields.push({
        id: fieldId,
        type: 'multi_select',
        label,
        required: true,
        config: {
          options,
          minSelections: mcProps.minAllowedSelections ? (mcProps.minAllowedSelections as { literalNumber: number }).literalNumber : undefined,
          maxSelections: mcProps.maxAllowedSelections ? (mcProps.maxAllowedSelections as { literalNumber: number }).literalNumber : undefined,
        },
      });
    }
  }

  return {
    version: '1.0',
    fields,
    config: step.schema?.config,
  };
}
