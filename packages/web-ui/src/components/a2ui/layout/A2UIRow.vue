<script setup lang="ts">
import { computed } from 'vue'
import type { RowProps } from '../types.js'

const props = defineProps<{
  id: string
  props: RowProps
}>()

// 对齐方式
const align = computed(() => {
  const a = props.props.align
  if (a && typeof a === 'object' && 'literalString' in a) {
    return a.literalString
  }
  return 'start'
})

// 间距
const gap = computed(() => {
  const g = props.props.gap
  if (g && typeof g === 'object' && 'literalString' in g) {
    return g.literalString
  }
  return 'medium'
})
</script>

<template>
  <div class="a2ui-row" :class="[`align-${align}`, `gap-${gap}`]">
    <slot />
  </div>
</template>

<style scoped>
.a2ui-row {
  display: flex;
  flex-direction: row;
  width: 100%;
}

.align-start {
  justify-content: flex-start;
}

.align-center {
  justify-content: center;
}

.align-end {
  justify-content: flex-end;
}

.align-stretch {
  justify-content: stretch;
}

.gap-none {
  gap: 0;
}

.gap-small {
  gap: 0.5rem;
}

.gap-medium {
  gap: 1rem;
}

.gap-large {
  gap: 1.5rem;
}
</style>
