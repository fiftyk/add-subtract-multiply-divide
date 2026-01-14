<script setup lang="ts">
import { computed } from 'vue'
import type { DateTimeInputProps, ValueChangePayload } from '../types.js'

const props = defineProps<{
  id: string
  props: DateTimeInputProps
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

// 提取字段名
const fieldName = computed(() => {
  const name = props.props.name
  if (name && typeof name === 'object' && 'literalString' in name) {
    return name.literalString
  }
  return props.id
})

// 输入模式
const inputMode = computed(() => {
  const mode = props.props.mode
  if (mode && typeof mode === 'object' && 'literalString' in mode) {
    return mode.literalString
  }
  return 'date'
})

// 最小日期
const minDate = computed(() => {
  const min = props.props.minDate
  if (min && typeof min === 'object' && 'literalString' in min) {
    return min.literalString
  }
  return undefined
})

// 最大日期
const maxDate = computed(() => {
  const max = props.props.maxDate
  if (max && typeof max === 'object' && 'literalString' in max) {
    return max.literalString
  }
  return undefined
})

// 是否必填
const isRequired = computed(() => {
  const required = props.props.required
  if (required && typeof required === 'object' && 'literalBoolean' in required) {
    return required.literalBoolean
  }
  return false
})

// 处理输入
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('value-change', {
    id: props.id,
    name: fieldName.value,
    value: target.value,
  })
}
</script>

<template>
  <div class="a2ui-datetime-input">
    <label v-if="labelText" class="a2ui-datetime-label">
      {{ labelText }}
      <span v-if="isRequired" class="a2ui-required">*</span>
    </label>

    <input
      class="a2ui-datetime-field"
      :type="inputMode"
      :min="minDate"
      :max="maxDate"
      :required="isRequired"
      :disabled="Boolean(props.props.disabled)"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.a2ui-datetime-input {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0.5rem 0;
}

.a2ui-datetime-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.a2ui-required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.a2ui-datetime-field {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #111827;
  transition: border-color 0.15s ease;
  width: 100%;
}

.a2ui-datetime-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.a2ui-datetime-field:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
