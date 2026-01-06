/**
 * A2UI Component Utilities
 *
 * Helper functions for working with A2UI components in Vue
 */

import type { A2UIComponent } from '../../../src/a2ui/types';

/**
 * Extract component type and props from A2UIComponent
 *
 * A2UIComponent structure: { id: "...", component: { "Text": { text: "..." } } }
 * Returns: { type: "Text", props: { text: "..." } }
 */
export function extractComponentData<T = Record<string, unknown>>(
  component: A2UIComponent
): { type: string; props: T } {
  const entries = Object.entries(component.component);

  if (entries.length === 0) {
    throw new Error(`Invalid A2UIComponent: no component type found for id ${component.id}`);
  }

  const [type, props] = entries[0];
  return { type, props: props as T };
}

/**
 * Get props of a specific component type
 *
 * Usage: getProps<TextProps>(component)
 */
export function getProps<T = Record<string, unknown>>(
  component: A2UIComponent
): T {
  return extractComponentData<T>(component).props;
}

/**
 * Get component type name
 */
export function getComponentType(component: A2UIComponent): string {
  return extractComponentData(component).type;
}

// ================ Runtime Validation ================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a component's props against required fields
 */
export function validateComponentProps(
  component: A2UIComponent,
  requiredFields: string[]
): ValidationResult {
  const errors: string[] = [];
  const props = extractComponentData(component).props;

  for (const field of requiredFields) {
    if (props[field as keyof typeof props] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type guard to check if component is of a specific type
 */
export function isComponentType<T extends Record<string, unknown>>(
  component: A2UIComponent,
  typeName: string
): component is A2UIComponent & { component: { [K in typeName]: T } } {
  return typeName in component.component;
}

/**
 * Safely get component props with type narrowing
 * Returns null if component is undefined or type doesn't match
 */
export function safeGetProps<T extends Record<string, unknown>>(
  component: A2UIComponent | undefined,
  expectedType: string
): T | null {
  if (!component) return null;

  const { type, props } = extractComponentData(component);

  if (type !== expectedType) {
    console.warn(`Expected component type "${expectedType}", got "${type}"`);
    return null;
  }

  return props as T;
}
