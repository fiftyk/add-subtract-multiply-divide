<script setup lang="ts">
import { computed } from 'vue'
import type { ProgressProps } from '../types.js'

const props = defineProps<{
  id: string
  props: ProgressProps
}>()

// 提取值
const value = computed(() => {
  const v = props.props.value
  if (v && typeof v === 'object' && 'literalNumber' in v) {
    return v.literalNumber
  }
  return 0
})

// 最大值
const max = computed(() => {
  const m = props.props.max
  if (m && typeof m === 'object' && 'literalNumber' in m) {
    return m.literalNumber
  }
  return 100
})

// 进度百分比
const percentage = computed(() => {
  if (max.value === 0) return 0
  return Math.min(100, Math.max(0, (value.value / max.value) * 100))
})

// 标签
const label = computed(() => {
  const l = props.props.label
  if (l && typeof l === 'object' && 'literalString' in l) {
    return l.literalString
  }
  return null
})
</script>

<template>
  <div class="a2ui-progress">
    <div
      class="a2ui-progress-bar"
      :style="{ width: `${percentage}%` }"
    />
    <span v-if="label" class="a2ui-progress-label">{{ label }} ({{ percentage.toFixed(0) }}%)</span>
  </div>
</template>

<style scoped>
.a2ui-progress {
  width: 100%;
  height: 0.5rem;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
}

.a2ui-progress-bar {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.a2ui-progress-label {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: #374151;
  font-weight: 500;
}
</style>
