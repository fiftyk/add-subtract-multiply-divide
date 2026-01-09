<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900">Execution Plans</h1>
      <button
        @click="refresh"
        :disabled="loading"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {{ loading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <!-- Plans List -->
    <div v-if="!loading && plans.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
        @click="viewPlan(plan.id)"
      >
        <div class="flex items-start justify-between mb-3">
          <h3 class="text-lg font-semibold text-gray-900 flex-1">{{ plan.id }}</h3>
          <span
            class="px-2 py-1 text-xs font-medium rounded"
            :class="{
              'bg-green-100 text-green-800': plan.status === 'executable',
              'bg-yellow-100 text-yellow-800': plan.status === 'pending',
              'bg-red-100 text-red-800': plan.status === 'invalid'
            }"
          >
            {{ plan.status }}
          </span>
        </div>
        <p class="text-gray-600 mb-3">{{ plan.userRequest }}</p>
        <p class="text-sm text-gray-500">
          Created: {{ new Date(plan.createdAt).toLocaleString() }}
        </p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && plans.length === 0" class="text-center py-12">
      <p class="text-gray-500">No plans available. Create one using the CLI first.</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">Loading plans...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlansStore } from '../stores/plans'

const router = useRouter()
const plansStore = usePlansStore()
const { plans, loading, error } = storeToRefs(plansStore)

onMounted(async () => {
  await refresh()
})

async function refresh() {
  try {
    await plansStore.loadPlans()
  } catch (err) {
    console.error('Failed to load plans:', err)
  }
}

function viewPlan(planId: string) {
  router.push(`/plans/${planId}`)
}
</script>
