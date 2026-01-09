<template>
  <div>
    <div class="mb-6">
      <router-link to="/plans" class="text-blue-600 hover:text-blue-700 flex items-center">
        ← Back to Plans
      </router-link>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">Loading plan...</p>
    </div>

    <!-- Error Message -->
    <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <!-- Plan Details -->
    <div v-else-if="selectedPlan" class="bg-white rounded-lg shadow">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">{{ selectedPlan.id }}</h1>
            <p class="text-gray-600">{{ selectedPlan.userRequest }}</p>
          </div>
          <span
            class="px-3 py-1 text-sm font-medium rounded"
            :class="{
              'bg-green-100 text-green-800': selectedPlan.status === 'executable',
              'bg-yellow-100 text-yellow-800': selectedPlan.status === 'pending',
              'bg-red-100 text-red-800': selectedPlan.status === 'invalid'
            }"
          >
            {{ selectedPlan.status }}
          </span>
        </div>
        <p class="mt-3 text-sm text-gray-500">
          Created: {{ new Date(selectedPlan.createdAt).toLocaleString() }}
        </p>
      </div>

      <!-- Steps -->
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Execution Steps</h2>
        <div class="space-y-4">
          <div
            v-for="step in selectedPlan.steps"
            :key="step.stepId"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-center mb-2">
              <span class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">
                {{ step.stepId }}
              </span>
              <span class="ml-3 text-sm font-medium text-gray-700">
                {{ step.type === 'function_call' ? `Function: ${step.functionName}` : 'User Input' }}
              </span>
            </div>
            <p v-if="step.description" class="text-gray-600 ml-11">{{ step.description }}</p>
          </div>
        </div>
      </div>

      <!-- Execute Button -->
      <div class="p-6 border-t border-gray-200 bg-gray-50">
        <button
          @click="execute"
          :disabled="selectedPlan.status !== 'executable' || executing"
          class="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ executing ? 'Starting...' : 'Execute Plan' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlansStore } from '../stores/plans'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const plansStore = usePlansStore()
const sessionStore = useSessionStore()

const { selectedPlan, loading, error } = storeToRefs(plansStore)
const executing = ref(false)

onMounted(async () => {
  const planId = route.params.id as string
  try {
    await plansStore.loadPlan(planId)
  } catch (err) {
    console.error('Failed to load plan:', err)
  }
})

async function execute() {
  if (!selectedPlan.value) return

  executing.value = true
  try {
    await sessionStore.startExecution(selectedPlan.value.id)
    // Navigate to execution view
    router.push(`/execution/${sessionStore.currentSessionId}`)
  } catch (err) {
    console.error('Failed to start execution:', err)
    alert('Failed to start execution: ' + (err instanceof Error ? err.message : 'Unknown error'))
  } finally {
    executing.value = false
  }
}
</script>
