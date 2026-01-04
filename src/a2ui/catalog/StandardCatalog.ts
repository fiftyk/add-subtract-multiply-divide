/**
 * 标准组件目录实现
 */

import 'reflect-metadata';
import { injectable } from 'inversify';
import type { ComponentCatalog, ComponentDefinition, Component } from '../interfaces/index.js';

export const STANDARD_CATALOG_ID = 'https://github.com/google/A2UI/specification/0.8/standard';

@injectable()
export class StandardCatalog implements ComponentCatalog {
  readonly id = STANDARD_CATALOG_ID;
  readonly name = 'Standard A2UI Components';

  private readonly components: Record<string, ComponentDefinition> = {
    Text: {
      properties: {
        text: { type: 'bound', types: ['string'] },
        style: { type: 'enum', values: ['body', 'heading', 'caption', 'title'] },
      },
    },
    TextInput: {
      properties: {
        placeholder: { type: 'bound', types: ['string'] },
        value: { type: 'bound', types: ['string'] },
        disabled: { type: 'bound', types: ['boolean'] },
      },
      events: ['change', 'focus', 'blur'],
    },
    NumberInput: {
      properties: {
        placeholder: { type: 'bound', types: ['string'] },
        value: { type: 'bound', types: ['number'] },
        min: { type: 'literal', types: ['number'] },
        max: { type: 'literal', types: ['number'] },
        disabled: { type: 'bound', types: ['boolean'] },
      },
      events: ['change', 'focus', 'blur'],
    },
    Button: {
      properties: {
        label: { type: 'bound', types: ['string'] },
        disabled: { type: 'bound', types: ['boolean'] },
      },
      events: ['click'],
    },
    Select: {
      properties: {
        options: { type: 'array' },
        value: { type: 'bound', types: ['string', 'number'] },
        placeholder: { type: 'bound', types: ['string'] },
        disabled: { type: 'bound', types: ['boolean'] },
      },
      events: ['change'],
    },
    MultiSelect: {
      properties: {
        options: { type: 'array' },
        value: { type: 'bound', types: ['array'] },
        placeholder: { type: 'bound', types: ['string'] },
        disabled: { type: 'bound', types: ['boolean'] },
        minSelections: { type: 'literal', types: ['number'] },
        maxSelections: { type: 'literal', types: ['number'] },
      },
      events: ['change'],
    },
    Checkbox: {
      properties: {
        label: { type: 'bound', types: ['string'] },
        checked: { type: 'bound', types: ['boolean'] },
        disabled: { type: 'bound', types: ['boolean'] },
      },
      events: ['change'],
    },
    Card: {
      properties: {
        title: { type: 'bound', types: ['string'] },
        subtitle: { type: 'bound', types: ['string'] },
      },
      children: { mode: 'single' },
    },
    Column: {
      properties: {
        gap: { type: 'literal', types: ['number'] },
        padding: { type: 'literal', types: ['number'] },
      },
      children: { mode: 'explicit' },
    },
    Row: {
      properties: {
        gap: { type: 'literal', types: ['number'] },
        padding: { type: 'literal', types: ['number'] },
        align: { type: 'enum', values: ['start', 'center', 'end', 'stretch'] },
      },
      children: { mode: 'explicit' },
    },
    Form: {
      properties: {
        title: { type: 'bound', types: ['string'] },
      },
      children: { mode: 'explicit' },
    },
    List: {
      properties: {
        items: { type: 'array' },
      },
      children: { mode: 'template', templateDataBinding: '/items' },
    },
  };

  getComponentDefinition(componentType: string): ComponentDefinition | undefined {
    return this.components[componentType];
  }

  getComponentTypes(): string[] {
    return Object.keys(this.components);
  }

  validateComponent(component: Component): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查组件类型是否存在
    const componentType = Object.keys(component.component)[0];
    if (!componentType) {
      errors.push('Component must have exactly one type');
      return { valid: false, errors };
    }

    const definition = this.getComponentDefinition(componentType);
    if (!definition) {
      errors.push(`Unknown component type: ${componentType}`);
      return { valid: false, errors };
    }

    // 验证必填属性
    for (const [propName, propDef] of Object.entries(definition.properties)) {
      if (propDef.required && !(propName in component.component[componentType])) {
        errors.push(`Missing required property: ${propName}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
