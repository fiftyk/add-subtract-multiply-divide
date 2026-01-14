/**
 * A2UI v0.8 Type Definition Tests
 * TDD tests for official A2UI v0.8 type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  BoundValue,
  TextValue,
  NumberValue,
  BooleanValue,
  TextProps,
  TextFieldProps,
  MultipleChoiceProps,
  ListProps,
  ColumnProps,
  RowProps,
  A2UIComponent,
  SurfaceDefinition,
} from '../types.js';

// ================ BoundValue Type Tests ================

describe('A2UI v0.8 BoundValue Types', () => {
  describe('LiteralValue variants', () => {
    it('should accept literalString', () => {
      const value: BoundValue = { literalString: '静态文本' };
      expect(value.literalString).toBe('静态文本');
    });

    it('should accept literalNumber', () => {
      const value: BoundValue = { literalNumber: 42 };
      expect(value.literalNumber).toBe(42);
    });

    it('should accept literalBoolean', () => {
      const value: BoundValue = { literalBoolean: true };
      expect(value.literalBoolean).toBe(true);
    });

    it('should accept literalArray', () => {
      const value: BoundValue = { literalArray: ['a', 'b', 'c'] };
      expect(value.literalArray).toHaveLength(3);
    });

    it('should accept path', () => {
      const value: BoundValue = { path: '/step1/input/keyword' };
      expect(value.path).toBe('/step1/input/keyword');
    });
  });

  describe('TextValue type', () => {
    it('should accept literalString variant', () => {
      const value: TextValue = { literalString: '标题' };
      expect((value as { literalString: string }).literalString).toBe('标题');
    });

    it('should accept path variant', () => {
      const value: TextValue = { path: '/labels/title' };
      expect((value as { path: string }).path).toBe('/labels/title');
    });
  });

  describe('NumberValue type', () => {
    it('should accept literalNumber variant', () => {
      const value: NumberValue = { literalNumber: 10 };
      expect((value as { literalNumber: number }).literalNumber).toBe(10);
    });

    it('should accept path variant', () => {
      const value: NumberValue = { path: '/config/count' };
      expect((value as { path: string }).path).toBe('/config/count');
    });
  });

  describe('BooleanValue type', () => {
    it('should accept literalBoolean variant', () => {
      const value: BooleanValue = { literalBoolean: true };
      expect((value as { literalBoolean: boolean }).literalBoolean).toBe(true);
    });

    it('should accept path variant', () => {
      const value: BooleanValue = { path: '/config/enabled' };
      expect((value as { path: string }).path).toBe('/config/enabled');
    });
  });
});

// ================ Component Props Type Tests ================

describe('A2UI v0.8 Component Props', () => {
  describe('TextProps', () => {
    it('should require text of TextValue type', () => {
      const props: TextProps = {
        text: { literalString: '搜索结果' },
        usageHint: { literalString: 'h3' }
      };
      expect(props.text.literalString).toBe('搜索结果');
      expect(props.usageHint?.literalString).toBe('h3');
    });

    it('should support h1-h5, caption, body usageHint values', () => {
      const hints = ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'] as const;
      hints.forEach((hint) => {
        const props: TextProps = {
          text: { literalString: '标题' },
          usageHint: { literalString: hint }
        };
        expect(props.usageHint?.literalString).toBe(hint);
      });
    });
  });

  describe('TextFieldProps', () => {
    it('should support all textFieldType values', () => {
      const types = ['shortText', 'longText', 'number', 'email', 'password'] as const;
      types.forEach((type) => {
        const props: TextFieldProps = {
          label: { literalString: '标签' },
          text: { path: '/input/value' },
          textFieldType: { literalString: type }
        };
        expect(props.textFieldType?.literalString).toBe(type);
      });
    });

    it('should require text binding with path', () => {
      const props: TextFieldProps = {
        label: { literalString: '关键词' },
        text: { path: '/step1/input/keyword' },
        textFieldType: { literalString: 'shortText' }
      };
      expect(props.text.path).toBe('/step1/input/keyword');
    });

    it('should support required as BooleanValue', () => {
      const props: TextFieldProps = {
        label: { literalString: '必填项' },
        text: { path: '/input/value' },
        required: { literalBoolean: true }
      };
      expect(props.required?.literalBoolean).toBe(true);
    });
  });

  describe('MultipleChoiceProps', () => {
    it('should require selections binding with path', () => {
      const props: MultipleChoiceProps = {
        label: { literalString: '选择' },
        selections: { path: '/step3/input/patentIds' },
        options: { path: '/step2/result/docs' },
        optionLabel: 'PN_STR',
        optionValue: '_id',
        maxAllowedSelections: { literalNumber: 5 }
      };
      expect(props.selections.path).toBe('/step3/input/patentIds');
      expect(props.maxAllowedSelections?.literalNumber).toBe(5);
    });

    it('should support explicitList options', () => {
      const props: MultipleChoiceProps = {
        label: { literalString: '状态' },
        selections: { path: '/input/status' },
        options: {
          explicitList: [
            { label: '进行中', value: 'running' },
            { label: '已完成', value: 'completed' }
          ]
        },
        maxAllowedSelections: { literalNumber: 1 }
      };
      const options = (props.options as { explicitList: Array<{ label: string; value: string }> }).explicitList;
      expect(options).toHaveLength(2);
    });
  });

  describe('ListProps', () => {
    it('should support children from path', () => {
      const props: ListProps = {
        children: { path: '/step2/result/docs' }
      };
      expect((props.children as { path: string }).path).toBe('/step2/result/docs');
    });

    it('should support explicitList children', () => {
      const props: ListProps = {
        children: {
          explicitList: ['header', 'item1', 'item2']
        }
      };
      expect((props.children as { explicitList: string[] }).explicitList).toHaveLength(3);
    });

    it('should support direction', () => {
      const props: ListProps = {
        children: { path: '/items' },
        direction: { literalString: 'vertical' }
      };
      expect(props.direction?.literalString).toBe('vertical');
    });
  });

  describe('ColumnProps', () => {
    it('should support distribution values', () => {
      const distributions = ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'] as const;
      distributions.forEach((dist) => {
        const props: ColumnProps = {
          children: { explicitList: ['a'] },
          distribution: { literalString: dist }
        };
        expect(props.distribution?.literalString).toBe(dist);
      });
    });

    it('should support children explicitList', () => {
      const props: ColumnProps = {
        children: {
          explicitList: ['title', 'field1', 'field2', 'button']
        }
      };
      expect((props.children as { explicitList: string[] }).explicitList).toHaveLength(4);
    });
  });

  describe('RowProps', () => {
    it('should support distribution values', () => {
      const distributions = ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'] as const;
      distributions.forEach((dist) => {
        const props: RowProps = {
          children: { explicitList: ['a'] },
          distribution: { literalString: dist }
        };
        expect(props.distribution?.literalString).toBe(dist);
      });
    });
  });
});

// ================ Surface Definition Tests ================

describe('A2UI Surface Definition', () => {
  it('should define surface with surfaceId and root', () => {
    const surface: SurfaceDefinition = {
      surfaceId: 'step1-input',
      root: 'input-form',
      components: []
    };
    expect(surface.surfaceId).toBe('step1-input');
    expect(surface.root).toBe('input-form');
  });

  it('should contain components with id and component', () => {
    const component: A2UIComponent = {
      id: 'title',
      component: {
        Text: {
          text: { literalString: '标题' },
          usageHint: { literalString: 'h3' }
        }
      }
    };

    expect(component.id).toBe('title');
    expect(component.component.Text.text.literalString).toBe('标题');
    expect(component.component.Text.usageHint?.literalString).toBe('h3');
  });

  it('should support flat component list', () => {
    const surface: SurfaceDefinition = {
      surfaceId: 'test',
      root: 'root-id',
      components: [
        {
          id: 'comp1',
          component: { Text: { text: { literalString: '文本1' } } }
        },
        {
          id: 'comp2',
          component: { Text: { text: { literalString: '文本2' } } }
        },
        {
          id: 'root-id',
          component: {
            Column: {
              children: { explicitList: ['comp1', 'comp2'] }
            }
          }
        }
      ]
    };

    expect(surface.components).toHaveLength(3);
    expect(surface.components[2].id).toBe('root-id');
  });
});
