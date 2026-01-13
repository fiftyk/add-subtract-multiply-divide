/**
 * A2UI Types Tests
 * TDD tests for A2UI component props
 */

import { describe, it, expect } from 'vitest';
import type { CardProps, ProgressProps, BadgeProps } from '../types.js';

describe('A2UI Component Props', () => {
  describe('CardProps', () => {
    it('should support title field', () => {
      const props: CardProps = {
        title: '步骤说明',
      };
      expect(props.title).toBe('步骤说明');
    });

    it('should support content field for description text', () => {
      const props: CardProps = {
        title: '基本信息',
        content: '请填写您的产品基本信息，包括类别、数量和配送要求',
      };
      expect(props.content).toBe('请填写您的产品基本信息，包括类别、数量和配送要求');
    });

    it('should support children array for multiple content items', () => {
      const props: CardProps = {
        title: '注意事项',
        children: ['请确保信息准确', '联系方式有效', '地址详细'],
      };
      expect(props.children).toHaveLength(3);
      expect(props.children?.[0]).toBe('请确保信息准确');
    });

    it('should support both content and children together', () => {
      const props: CardProps = {
        title: '配送信息',
        content: '请选择配送方式',
        children: ['普通配送免费', '加急配送+50元', '特急配送+100元'],
      };
      expect(props.content).toBe('请选择配送方式');
      expect(props.children).toHaveLength(3);
    });

    it('should allow empty props', () => {
      const props: CardProps = {};
      expect(props.title).toBeUndefined();
      expect(props.content).toBeUndefined();
      expect(props.children).toBeUndefined();
    });
  });

  describe('ProgressProps', () => {
    it('should require value field', () => {
      const props: ProgressProps = {
        value: 50,
      };
      expect(props.value).toBe(50);
    });

    it('should support optional max field', () => {
      const props: ProgressProps = {
        value: 3,
        max: 5,
      };
      expect(props.value).toBe(3);
      expect(props.max).toBe(5);
    });

    it('should support optional label field', () => {
      const props: ProgressProps = {
        value: 1,
        max: 5,
        label: 'Step 1/5: 填写基本信息',
      };
      expect(props.label).toBe('Step 1/5: 填写基本信息');
    });

    it('should calculate percentage correctly', () => {
      const props: ProgressProps = {
        value: 2,
        max: 10,
      };
      const percentage = (props.value / (props.max || 100)) * 100;
      expect(percentage).toBe(20);
    });
  });

  describe('BadgeProps', () => {
    it('should require text field', () => {
      const props: BadgeProps = {
        text: '已填写',
      };
      expect(props.text).toBe('已填写');
    });

    it('should support optional variant field', () => {
      const props: BadgeProps = {
        text: '已完成',
        variant: 'success',
      };
      expect(props.variant).toBe('success');
    });

    it('should support all variant types', () => {
      const variants: BadgeProps['variant'][] = ['success', 'warning', 'error', 'info'];
      variants.forEach((variant) => {
        const props: BadgeProps = { text: '状态', variant };
        expect(props.variant).toBe(variant);
      });
    });
  });
});
