<template>
  <span :class="['badge', `badge-${component.props.variant || 'info'}`]">
    {{ component.props.text }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { text: string; variant?: string } };
}>();
</script>
