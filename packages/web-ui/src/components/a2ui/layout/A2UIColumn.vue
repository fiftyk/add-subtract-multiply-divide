<script setup lang="ts">
import { computed } from 'vue'
import type { ColumnProps } from '../types.js'

const props = defineProps<{
  id: string
  props: ColumnProps
}>()

// 宽度
const width = computed(() => {
  const w = props.props.width
  if (w && typeof w === 'object' && 'literalString' in w) {
    return w.literalString
  }
  return 'auto'
})

// 对齐方式
const align = computed(() => {
  const a = props.props.align
  if (a && typeof a === 'object' && 'literalString' in a) {
    return a.literalString
  }
  return 'start'
})
</script>

<template>
  <div class="a2ui-column" :class="[`width-${width}`, `align-${align}`]">
    <slot />
  </div>
</template>

<style scoped>
.a2ui-column {
  display: flex;
  flex-direction: column;
}

.width-auto {
  flex: 0 0 auto;
}

.width-half {
  flex: 0 0 50%;
}

.width-third {
  flex: 0 0 33.333%;
}

.width-full {
  flex: 1;
}

.align-start {
  align-items: flex-start;
}

.align-center {
  align-items: center;
}

.align-end {
  align-items: flex-end;
}

.align-stretch {
  align-items: stretch;
}
</style>
