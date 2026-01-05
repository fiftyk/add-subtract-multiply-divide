/**
 * A2UI Service - High-level API for CLI/Web rendering
 * 
 * Provides a simplified interface for business logic to emit A2UI messages
 * without knowing about specific renderers.
 */

import { v4 as uuidv4 } from 'uuid';
import type { A2UIRenderer as A2UIRendererType } from './A2UIRenderer.js';
import type { A2UIComponent } from './types.js';

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
}
