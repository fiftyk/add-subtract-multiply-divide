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

      <!-- Execution History Button -->
      <div class="p-6 border-t border-gray-200">
        <button
          @click="openDrawer"
          class="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-between"
        >
          <span>View Execution History</span>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 text-xs font-semibold bg-gray-600 text-white rounded-full">
              {{ planSessions.length }}
            </span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </div>
        </button>
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

    <!-- Drawer for Execution History -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        leave-active-class="transition-opacity duration-300 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="isDrawerOpen" class="fixed inset-0 z-50 overflow-hidden">
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            @click="closeDrawer"
          ></div>

          <!-- Drawer Panel -->
          <div
            class="absolute inset-y-0 right-0 max-w-full flex transition-transform duration-300 ease-out"
            :class="isDrawerOpen ? 'translate-x-0' : 'translate-x-full'"
          >
            <div class="w-screen max-w-md">
              <div class="h-full flex flex-col bg-white shadow-xl">
                <!-- Header -->
                <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-gray-900">Execution History</h2>
                    <button
                      @click="closeDrawer"
                      class="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ planSessions.length }} session{{ planSessions.length !== 1 ? 's' : '' }}
                  </p>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6">
                  <!-- Loading State -->
                  <div v-if="sessionsLoading" class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p class="mt-4 text-sm text-gray-600">Loading sessions...</p>
                  </div>

                  <!-- Empty State -->
                  <div v-else-if="planSessions.length === 0" class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="mt-4 text-gray-500">No execution history yet</p>
                    <p class="text-sm text-gray-400 mt-1">Execute the plan to create a session</p>
                  </div>

                  <!-- Sessions List -->
                  <div v-else class="space-y-3">
                    <div
                      v-for="session in planSessions"
                      :key="session.id"
                      class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                      @click="viewSession(session.id); closeDrawer()"
                    >
                      <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <span class="font-mono text-sm text-gray-700 truncate">{{ session.id }}</span>
                            <span
                              class="px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap"
                              :class="getStatusColor(session.status)"
                            >
                              {{ session.status }}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500 space-y-1">
                            <div class="flex items-center gap-1">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              {{ new Date(session.createdAt).toLocaleString() }}
                            </div>
                            <div v-if="session.completedAt" class="flex items-center gap-1">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                              {{ new Date(session.completedAt).toLocaleString() }}
                            </div>
                          </div>
                        </div>
                        <div class="flex-shrink-0 ml-4">
                          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

const { selectedPlan, planSessions, loading, sessionsLoading, error } = storeToRefs(plansStore)
const executing = ref(false)
const isDrawerOpen = ref(false)

onMounted(async () => {
  const planId = route.params.id as string
  try {
    await plansStore.loadPlan(planId)
    // Load sessions for this plan
    await plansStore.loadPlanSessions(planId)
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

function viewSession(sessionId: string) {
  router.push(`/execution/${sessionId}`)
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800'
    case 'failed': return 'bg-red-100 text-red-800'
    case 'waiting_input': return 'bg-purple-100 text-purple-800'
    case 'executing': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

function openDrawer() {
  isDrawerOpen.value = true
}

function closeDrawer() {
  isDrawerOpen.value = false
}
</script>
