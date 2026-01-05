<template>
  <div class="select">
    <label class="select-label">{{ component.props.label }}</label>
    <select
      class="select-input"
      :multiple="component.props.multiSelect"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in component.props.options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: {
    props: {
      label: string;
      options: Array<{ value: string | number; label: string; description?: string }>;
      multiSelect?: boolean;
    };
  };
  modelValue?: string | number;
}>();

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
