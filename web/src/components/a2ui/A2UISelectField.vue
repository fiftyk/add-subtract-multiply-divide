<template>
  <div class="select">
    <label class="select-label">{{ props.label }}</label>
    <select
      class="select-input"
      :multiple="props.multiSelect"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in props.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, SelectFieldProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
  modelValue?: string | number;
}>();

const props = computed(() => getProps<SelectFieldProps>(componentProp.component));

defineEmits<{
  'update:modelValue': [value: string | number];
}>();
</script>

<style scoped>
.select { margin-bottom: 16px; }
.select-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 6px; }
.select-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; background: white; cursor: pointer; }
.select-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2); }
</style>
