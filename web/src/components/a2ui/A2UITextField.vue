<template>
  <div class="textfield">
    <label class="textfield-label">
      {{ component.props.label }}
      <span v-if="component.props.required" class="required">*</span>
    </label>
    <textarea
      v-if="component.props.multiline"
      :id="component.props.name"
      class="textfield-input textfield-textarea"
      :placeholder="component.props.placeholder"
      :required="component.props.required"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <input
      v-else
      :id="component.props.name"
      type="text"
      class="textfield-input"
      :placeholder="component.props.placeholder"
      :required="component.props.required"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { label: string; name: string; placeholder?: string; required?: boolean; multiline?: boolean } };
  modelValue?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.textfield { margin-bottom: 16px; }
.textfield-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 6px; }
.required { color: #ef4444; margin-left: 2px; }
.textfield-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; transition: border-color 0.2s; }
.textfield-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2); }
.textfield-textarea { min-height: 100px; resize: vertical; }
</style>
