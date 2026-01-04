/**
 * 标准组件目录测试
 */

import { describe, it, expect } from 'vitest';
import { StandardCatalog } from '../catalog/StandardCatalog.js';

describe('StandardCatalog', () => {
  let catalog: StandardCatalog;

  beforeEach(() => {
    catalog = new StandardCatalog();
  });

  describe('id', () => {
    it('should have standard catalog id', () => {
      expect(catalog.id).toBe('https://github.com/google/A2UI/specification/0.8/standard');
    });
  });

  describe('name', () => {
    it('should have name', () => {
      expect(catalog.name).toBe('Standard A2UI Components');
    });
  });

  describe('getComponentTypes', () => {
    it('should return all component types', () => {
      const types = catalog.getComponentTypes();

      expect(types).toContain('Text');
      expect(types).toContain('TextInput');
      expect(types).toContain('Button');
      expect(types).toContain('Select');
      expect(types).toContain('Card');
    });

    it('should include common form components', () => {
      const types = catalog.getComponentTypes();

      expect(types).toContain('TextInput');
      expect(types).toContain('NumberInput');
      expect(types).toContain('Select');
      expect(types).toContain('MultiSelect');
      expect(types).toContain('Checkbox');
    });
  });

  describe('getComponentDefinition', () => {
    it('should return definition for Text component', () => {
      const definition = catalog.getComponentDefinition('Text');

      expect(definition).toBeDefined();
      expect(definition?.properties.text).toBeDefined();
    });

    it('should return definition for Button component', () => {
      const definition = catalog.getComponentDefinition('Button');

      expect(definition).toBeDefined();
      expect(definition?.properties.label).toBeDefined();
      expect(definition?.events).toContain('click');
    });

    it('should return undefined for unknown component', () => {
      const definition = catalog.getComponentDefinition('UnknownComponent');
      expect(definition).toBeUndefined();
    });
  });

  describe('validateComponent', () => {
    it('should validate valid Text component', () => {
      const component = {
        id: 'text1',
        component: { Text: { text: { literalString: 'Hello' } } },
      };

      const result = catalog.validateComponent(component);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Button component', () => {
      const component = {
        id: 'btn1',
        component: { Button: { label: { literalString: 'Click me' } } },
      };

      const result = catalog.validateComponent(component);

      expect(result.valid).toBe(true);
    });

    it('should reject component without type', () => {
      const component = {
        id: 'comp1',
        component: {},
      };

      const result = catalog.validateComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject unknown component type', () => {
      const component = {
        id: 'comp1',
        component: { UnknownType: {} },
      };

      const result = catalog.validateComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown component type'))).toBe(true);
    });
  });
});
