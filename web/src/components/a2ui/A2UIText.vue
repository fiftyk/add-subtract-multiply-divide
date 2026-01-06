<template>
  <div :class="['text', `text-${props.style || 'default'}`]">
    {{ props.text }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, TextProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<TextProps>(componentProp.component));
</script>
