<script setup lang="ts">
import { computed } from 'vue'
import type { CheckBoxProps, ValueChangePayload } from '../types.js'

const props = defineProps<{
  id: string
  props: CheckBoxProps
}>()

const emit = defineEmits<{
  (e: 'value-change', payload: ValueChangePayload): void
}>()

// 提取标签文本
const labelText = computed(() => {
  const label = props.props.label
  if (label && typeof label === 'object' && 'literalString' in label) {
    return label.literalString
  }
  return ''
})

// 是否选中
const isChecked = computed(() => {
  const checked = props.props.checked
  if (checked && typeof checked === 'object' && 'literalBoolean' in checked) {
    return checked.literalBoolean
  }
  return false
})

// 处理切换
function handleToggle() {
  emit('value-change', {
    id: props.id,
    name: props.id, // CheckBox 使用 id 作为 name
    value: !isChecked.value,
  })
}
</script>

<template>
  <div class="a2ui-checkbox" :class="{ 'a2ui-checkbox-disabled': props.props.disabled }">
    <label class="a2ui-checkbox-label">
      <input
        type="checkbox"
        class="a2ui-checkbox-input"
        :checked="isChecked"
        :disabled="Boolean(props.props.disabled)"
        @change="handleToggle"
      />
      <span class="a2ui-checkbox-text">{{ labelText }}</span>
    </label>
  </div>
</template>

<style scoped>
.a2ui-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
}

.a2ui-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.a2ui-checkbox-input {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
  border-radius: 0.25rem;
  border-color: #d1d5db;
}

.a2ui-checkbox-text {
  flex: 1;
}

.a2ui-checkbox-disabled {
  opacity: 0.6;
}

.a2ui-checkbox-disabled label {
  cursor: not-allowed;
}
</style>
