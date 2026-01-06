<template>
  <div class="column" :style="{ gap: `${props.gap || 12}px` }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, ColumnProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<ColumnProps>(componentProp.component));
</script>
