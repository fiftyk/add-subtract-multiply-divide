<template>
  <span :class="['badge', `badge-${props.variant || 'info'}`]">
    {{ props.text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, BadgeProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<BadgeProps>(componentProp.component));
</script>
