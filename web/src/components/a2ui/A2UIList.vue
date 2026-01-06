<template>
  <ul :class="['list', { 'list-ordered': props.ordered }]">
    <li v-for="(item, index) in props.children" :key="index" class="list-item">
      {{ item }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, ListProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<ListProps>(componentProp.component));
</script>

<style scoped>
.list { list-style: none; padding: 0; margin: 0; }
.list-item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.list-item:last-child { border-bottom: none; }
.list-ordered { list-style: decimal; padding-left: 20px; }
</style>
