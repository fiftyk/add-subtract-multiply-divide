<template>
  <ul :class="['list', { 'list-ordered': component.props.ordered }]">
    <li v-for="(item, index) in component.props.children" :key="index" class="list-item">
      {{ item }}
    </li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { children: string[]; ordered?: boolean } };
}>();
</script>

<style scoped>
.list { list-style: none; padding: 0; margin: 0; }
.list-item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.list-item:last-child { border-bottom: none; }
.list-ordered { list-style: decimal; padding-left: 20px; }
</style>
