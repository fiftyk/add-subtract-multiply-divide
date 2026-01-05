<template>
  <div :class="['text', `text-${component.props.style || 'default'}`]">
    {{ component.props.text }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { text: string; style?: string } };
}>();
</script>
