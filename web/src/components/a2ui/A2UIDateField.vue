<template>
  <div class="date">
    <label class="date-label">{{ props.label }}</label>
    <input
      type="date"
      class="date-input"
      :min="props.minDate"
      :max="props.maxDate"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, DateFieldProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
  modelValue?: string;
}>();

const props = computed(() => getProps<DateFieldProps>(componentProp.component));

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.date { margin-bottom: 16px; }
.date-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 6px; }
.date-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }
.date-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2); }
</style>
