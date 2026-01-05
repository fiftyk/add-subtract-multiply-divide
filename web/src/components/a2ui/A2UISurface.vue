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
import { computed, h } from 'vue';
import type { A2UIComponent, Surface } from '../../../../../src/a2ui/types';
import A2UIText from './A2UIText.vue';
import A2UICard from './A2UICard.vue';
import A2UIRow from './A2UIRow.vue';
import A2UIColumn from './A2UIColumn.vue';
import A2UIList from './A2UIList.vue';
import A2UIButton from './A2UIButton.vue';
import A2UITextField from './A2UITextField.vue';
import A2UIProgress from './A2UIProgress.vue';
import A2UIBadge from './A2UIBadge.vue';
import A2UIDivider from './A2UIDivider.vue';
import A2UIDateField from './A2UIDateField.vue';
import A2UISelectField from './A2UISelectField.vue';
import A2UITable from './A2UITable.vue';

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

function renderComponent(comp: A2UIComponent) {
  if (!comp) return null;
  const [type, data] = Object.entries(comp.component)[0];

  const components: Record<string, any> = {
    Text: A2UIText,
    Card: A2UICard,
    Row: A2UIRow,
    Column: A2UIColumn,
    List: A2UIList,
    Button: A2UIButton,
    TextField: A2UITextField,
    Progress: A2UIProgress,
    Badge: A2UIBadge,
    Divider: A2UIDivider,
    DateField: A2UIDateField,
    SelectField: A2UISelectField,
    Table: A2UITable,
  };

  const component = components[type];
  if (!component) {
    console.warn(`Unknown component type: ${type}`);
    return () => h('div', { class: 'unknown-component' }, `Unknown: ${type}`);
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
