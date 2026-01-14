/**
 * A2UI Component Props with BoundValue Tests
 * TDD tests for component props using BoundValue types
 */

import { describe, it, expect } from 'vitest';

// ================ TextField Props Tests ================

describe('TextFieldProps', () => {
  describe('label', () => {
    it('should support literalString label', () => {
      const props = {
        TextField: {
          label: { literalString: '技术关键词' },
          text: { path: '/step1/input/keyword' },
          textFieldType: { literalString: 'shortText' }
        }
      };
      expect(props.TextField.label.literalString).toBe('技术关键词');
    });

    it('should support dynamic label via path', () => {
      const props = {
        TextField: {
          label: { path: '/labels/keyword' },
          text: { path: '/step1/input/keyword' },
          textFieldType: { literalString: 'shortText' }
        }
      };
      expect(props.TextField.label.path).toBe('/labels/keyword');
    });
  });

  describe('textFieldType', () => {
    it('should support shortText', () => {
      const props = {
        TextField: {
          label: { literalString: '名称' },
          text: { path: '/input/name' },
          textFieldType: { literalString: 'shortText' }
        }
      };
      expect(props.TextField.textFieldType.literalString).toBe('shortText');
    });

    it('should support longText', () => {
      const props = {
        TextField: {
          label: { literalString: '描述' },
          text: { path: '/input/description' },
          textFieldType: { literalString: 'longText' }
        }
      };
      expect(props.TextField.textFieldType.literalString).toBe('longText');
    });

    it('should support number', () => {
      const props = {
        TextField: {
          label: { literalString: '数量' },
          text: { path: '/input/rows' },
          textFieldType: { literalString: 'number' }
        }
      };
      expect(props.TextField.textFieldType.literalString).toBe('number');
    });
  });

  describe('text binding', () => {
    it('should bind to path', () => {
      const props = {
        TextField: {
          label: { literalString: '输入' },
          text: { path: '/step1/input/keyword' },
          textFieldType: { literalString: 'shortText' }
        }
      };
      expect(props.TextField.text.path).toBe('/step1/input/keyword');
    });
  });
});

// ================ MultipleChoice Props Tests ================

describe('MultipleChoiceProps', () => {
  it('should support selections binding', () => {
    const props = {
      MultipleChoice: {
        label: { literalString: '选择专利' },
        selections: { path: '/step3/input/patentIds' },
        options: { path: '/step2/result/docs' },
        optionLabel: 'PN_STR',
        optionValue: '_id',
        maxAllowedSelections: { literalNumber: 5 }
      }
    };
    expect(props.MultipleChoice.selections.path).toBe('/step3/input/patentIds');
    expect(props.MultipleChoice.maxAllowedSelections.literalNumber).toBe(5);
  });

  it('should support options from path', () => {
    const props = {
      MultipleChoice: {
        label: { literalString: '选择' },
        selections: { path: '/input/selected' },
        options: { path: '/step2/result/docs' },
        optionLabel: 'title',
        optionValue: 'id'
      }
    };
    expect(props.MultipleChoice.options.path).toBe('/step2/result/docs');
    expect(props.MultipleChoice.optionLabel).toBe('title');
    expect(props.MultipleChoice.optionValue).toBe('id');
  });

  it('should support explicitList options', () => {
    const props = {
      MultipleChoice: {
        label: { literalString: '状态' },
        selections: { path: '/input/status' },
        options: {
          explicitList: [
            { label: '进行中', value: 'running' },
            { label: '已完成', value: 'completed' }
          ]
        }
      }
    };
    expect(props.MultipleChoice.options.explicitList).toHaveLength(2);
    expect(props.MultipleChoice.options.explicitList[0].label).toBe('进行中');
  });
});

// ================ List Props Tests ================

describe('ListProps', () => {
  it('should support children from path', () => {
    const props = {
      List: {
        children: { path: '/step2/result/docs' }
      }
    };
    expect(props.List.children.path).toBe('/step2/result/docs');
  });

  it('should support explicitList children', () => {
    const props = {
      List: {
        children: {
          explicitList: ['item1', 'item2', 'item3']
        }
      }
    };
    expect(props.List.children.explicitList).toHaveLength(3);
  });

  it('should support direction', () => {
    const props = {
      List: {
        children: { path: '/items' },
        direction: { literalString: 'vertical' }
      }
    };
    expect(props.List.direction.literalString).toBe('vertical');
  });
});

// ================ Column/Row Props Tests ================

describe('Layout Props', () => {
  describe('ColumnProps', () => {
    it('should support children from explicitList', () => {
      const props = {
        Column: {
          children: {
            explicitList: ['title', 'field1', 'field2']
          }
        }
      };
      expect(props.Column.children.explicitList).toHaveLength(3);
    });

    it('should support distribution', () => {
      const props = {
        Column: {
          children: { explicitList: ['a', 'b'] },
          distribution: { literalString: 'start' }
        }
      };
      expect(props.Column.distribution.literalString).toBe('start');
    });

    it('should support all distribution values', () => {
      const distributions = ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'];
      distributions.forEach((dist) => {
        const props = {
          Column: {
            children: { explicitList: ['a'] },
            distribution: { literalString: dist as any }
          }
        };
        expect(props.Column.distribution.literalString).toBe(dist);
      });
    });
  });

  describe('RowProps', () => {
    it('should support children from explicitList', () => {
      const props = {
        Row: {
          children: {
            explicitList: ['col1', 'col2', 'col3']
          }
        }
      };
      expect(props.Row.children.explicitList).toHaveLength(3);
    });

    it('should support distribution', () => {
      const props = {
        Row: {
          children: { explicitList: ['a', 'b'] },
          distribution: { literalString: 'center' }
        }
      };
      expect(props.Row.distribution.literalString).toBe('center');
    });
  });
});

// ================ Text Props Tests ================

describe('TextProps', () => {
  it('should support literalString text', () => {
    const props = {
      Text: {
        text: { literalString: '搜索结果' },
        usageHint: { literalString: 'h3' }
      }
    };
    expect(props.Text.text.literalString).toBe('搜索结果');
  });

  it('should support usageHint values', () => {
    const usageHints: Array<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body'> =
      ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'];

    usageHints.forEach((hint) => {
      const props = {
        Text: {
          text: { literalString: '标题' },
          usageHint: { literalString: hint }
        }
      };
      expect(props.Text.usageHint.literalString).toBe(hint);
    });
  });
});
