<template>
  <div class="surface">
    <div v-if="surfaceTitle" class="surface-header">
      <h1>{{ surfaceTitle }}</h1>
    </div>
    <div class="surface-content">
      <component
        v-for="compId in surface.order"
        :key="compId"
        :is="renderComponent(surface.components.get(compId)!)"
        :component="surface.components.get(compId)"
        @action="emit('action', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, defineAsyncComponent } from 'vue';
import type { A2UIComponent, Surface } from '../../../../../src/a2ui/types';

// 组件映射表 - 在模块级别定义，避免每次渲染都重新创建
const COMPONENT_MAP: Record<string, any> = {
  Text: defineAsyncComponent(() => import('./A2UIText.vue')),
  Card: defineAsyncComponent(() => import('./A2UICard.vue')),
  Row: defineAsyncComponent(() => import('./A2UIRow.vue')),
  Column: defineAsyncComponent(() => import('./A2UIColumn.vue')),
  List: defineAsyncComponent(() => import('./A2UIList.vue')),
  Button: defineAsyncComponent(() => import('./A2UIButton.vue')),
  TextField: defineAsyncComponent(() => import('./A2UITextField.vue')),
  Progress: defineAsyncComponent(() => import('./A2UIProgress.vue')),
  Badge: defineAsyncComponent(() => import('./A2UIBadge.vue')),
  Divider: defineAsyncComponent(() => import('./A2UIDivider.vue')),
  DateField: defineAsyncComponent(() => import('./A2UIDateField.vue')),
  SelectField: defineAsyncComponent(() => import('./A2UISelectField.vue')),
  Table: defineAsyncComponent(() => import('./A2UITable.vue')),
};

// 未知组件占位符
const UnknownComponent = () => h('div', { class: 'unknown-component' }, 'Unknown Component');

const props = defineProps<{
  surface: Surface;
}>();

const emit = defineEmits<{
  action: [action: any];
}>();

const surfaceTitle = computed(() => {
  const root = props.surface.components.get(props.surface.rootId);
  if (!root) return null;
  const [type, data] = Object.entries(root.component)[0];
  if (type === 'Card' && data.title) return data.title;
  if (type === 'Text') return data.text;
  return null;
});

function renderComponent(comp: A2UIComponent | undefined) {
  if (!comp) return null;

  const [type] = Object.keys(comp.component);
  const component = COMPONENT_MAP[type];

  if (!component) {
    console.warn(`Unknown component type: ${type}`);
    return UnknownComponent;
  }

  return component;
}
</script>

<style scoped>
.surface {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  max-width: 900px;
  margin: 0 auto 20px;
}

.surface-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
}

.surface-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.surface-content {
  padding: 20px;
}
</style>
