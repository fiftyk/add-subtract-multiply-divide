<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonProps, ClickPayload } from '../types.js'

const props = defineProps<{
  id: string
  props: ButtonProps
}>()

const emit = defineEmits<{
  (e: 'click', payload: ClickPayload): void
}>()

// 提取标签文本
const labelText = computed(() => {
  const label = props.props.label
  if (label && typeof label === 'object' && 'literalString' in label) {
    return label.literalString
  }
  return ''
})

// 按钮变体
const variant = computed(() => {
  const v = props.props.variant
  if (v && typeof v === 'object' && 'literalString' in v) {
    return v.literalString
  }
  return 'primary'
})

// 处理点击
function handleClick() {
  emit('click', {
    id: props.id,
  })
}
</script>

<template>
  <button
    class="a2ui-button"
    :class="variant"
    :disabled="Boolean(props.props.disabled)"
    @click="handleClick"
  >
    {{ labelText }}
  </button>
</template>

<style scoped>
.a2ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.a2ui-button.primary {
  background-color: #3b82f6;
  color: white;
}

.a2ui-button.primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.a2ui-button.secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.a2ui-button.secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.a2ui-button.danger {
  background-color: #ef4444;
  color: white;
}

.a2ui-button.danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.a2ui-button.ghost {
  background-color: transparent;
  color: #374151;
}

.a2ui-button.ghost:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.a2ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
