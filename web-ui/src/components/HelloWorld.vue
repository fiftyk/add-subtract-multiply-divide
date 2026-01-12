<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <h1 class="text-3xl font-bold mb-4">{{ msg }}</h1>

  <div class="p-4 bg-gray-50 rounded-lg mb-4">
    <button
      type="button"
      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      @click="count++"
    >
      count is {{ count }}
    </button>
    <p class="mt-2 text-sm text-gray-600">
      Edit
      <code class="bg-gray-200 px-1 rounded text-sm">components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <p class="mb-2">
    Check out
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank" class="text-blue-600 hover:underline"
      >create-vue</a
    >, the official Vue + Vite starter
  </p>
  <p class="mb-2">
    Learn more about IDE Support for Vue in the
    <a
      href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
      target="_blank"
      class="text-blue-600 hover:underline"
      >Vue Docs Scaling up Guide</a
    >.
  </p>
  <p class="text-gray-400 text-sm">Click on the Vite and Vue logos to learn more</p>
</template>
