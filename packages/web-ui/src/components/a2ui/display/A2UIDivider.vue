<script setup lang="ts">
import { computed } from 'vue'
import type { DividerProps } from '../types.js'

const props = defineProps<{
  id: string
  props: DividerProps
}>()

// 方向
const direction = computed(() => {
  const d = props.props.direction
  if (d && typeof d === 'object' && 'literalString' in d) {
    return d.literalString
  }
  return 'horizontal'
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
  <div class="a2ui-divider" :class="[`direction-${direction}`]">
    <span v-if="label" class="a2ui-divider-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.a2ui-divider {
  margin: 1rem 0;
}

.a2ui-divider.direction-horizontal {
  height: 1px;
  background-color: #e5e7eb;
  position: relative;
  display: flex;
  align-items: center;
}

.a2ui-divider.direction-vertical {
  width: 1px;
  height: 100%;
  min-height: 1.5rem;
  background-color: #e5e7eb;
  display: inline-block;
  margin: 0 0.5rem;
  vertical-align: middle;
}

.a2ui-divider-label {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background-color: white;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
