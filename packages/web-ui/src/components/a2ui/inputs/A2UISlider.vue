<script setup lang="ts">
import { computed } from 'vue'
import type { SliderProps, ValueChangePayload } from '../types.js'

const props = defineProps<{
  id: string
  props: SliderProps
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

// 值
const value = computed(() => {
  const val = props.props.value
  if (val && typeof val === 'object' && 'literalNumber' in val) {
    return val.literalNumber
  }
  return 0
})

// 最小值
const minValue = computed(() => {
  const min = props.props.minValue
  if (min && typeof min === 'object' && 'literalNumber' in min) {
    return min.literalNumber
  }
  return 0
})

// 最大值
const maxValue = computed(() => {
  const max = props.props.maxValue
  if (max && typeof max === 'object' && 'literalNumber' in max) {
    return max.literalNumber
  }
  return 100
})

// 步长
const step = computed(() => {
  const s = props.props.step
  if (s && typeof s === 'object' && 'literalNumber' in s) {
    return s.literalNumber
  }
  return 1
})

// 处理滑块变化
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const numValue = parseFloat(target.value)

  emit('value-change', {
    id: props.id,
    name: fieldName.value,
    value: numValue,
  })
}
</script>

<template>
  <div class="a2ui-slider">
    <label v-if="labelText" class="a2ui-slider-label">{{ labelText }}</label>

    <input
      type="range"
      class="a2ui-slider-input"
      :min="minValue"
      :max="maxValue"
      :step="step"
      :value="value"
      :disabled="Boolean(props.props.disabled)"
      @input="handleInput"
    />

    <span class="a2ui-slider-value">{{ value }}</span>
  </div>
</template>

<style scoped>
.a2ui-slider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.a2ui-slider-label {
  font-size: 0.875rem;
  color: #374151;
  min-width: 60px;
}

.a2ui-slider-input {
  flex: 1;
  height: 0.375rem;
  background-color: #e5e7eb;
  border-radius: 9999px;
  appearance: none;
  cursor: pointer;
}

.a2ui-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  background-color: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.a2ui-slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.a2ui-slider-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  min-width: 40px;
  text-align: right;
}

.a2ui-slider-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
