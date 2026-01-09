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
      <p class="mt-4 text-gray-600">Loading session...</p>
    </div>

    <!-- Error Message -->
    <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-800">{{ error }}</p>
      <button
        @click="sessionStore.clearError"
        class="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Clear Error
      </button>
    </div>

    <!-- Execution View -->
    <div v-else class="space-y-6">
      <!-- Status Header -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Execution Progress</h1>
            <p class="text-sm text-gray-500 mt-1">Session: {{ currentSessionId }}</p>
          </div>
          <span
            class="px-4 py-2 text-sm font-medium rounded-lg"
            :class="{
              'bg-yellow-100 text-yellow-800': status === 'pending',
              'bg-blue-100 text-blue-800 animate-pulse': status === 'executing',
              'bg-purple-100 text-purple-800': status === 'waiting_input',
              'bg-green-100 text-green-800': status === 'completed',
              'bg-red-100 text-red-800': status === 'failed'
            }"
          >
            {{ statusLabel }}
          </span>
        </div>

        <!-- Progress Indicator -->
        <div v-if="isExecuting" class="mt-4">
          <div class="flex items-center">
            <div class="flex-1">
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-600 transition-all duration-300"
                  :style="{ width: progressPercentage + '%' }"
                ></div>
              </div>
            </div>
            <span class="ml-4 text-sm font-medium text-gray-700">
              Step {{ currentStep }}
            </span>
          </div>
        </div>
      </div>

      <!-- Step Results -->
      <div v-if="stepResults.length > 0" class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Completed Steps</h2>
        <div class="space-y-3">
          <div
            v-for="result in stepResults"
            :key="result.stepId"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-start">
              <span
                class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold"
                :class="{
                  'bg-green-100 text-green-800': result.success,
                  'bg-red-100 text-red-800': !result.success
                }"
              >
                {{ result.stepId }}
              </span>
              <div class="ml-3 flex-1">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-700">
                    {{ result.type === 'function_call' ? 'Function Call' : 'User Input' }}
                  </span>
                  <span
                    class="ml-2 text-xs px-2 py-1 rounded"
                    :class="{
                      'bg-green-100 text-green-700': result.success,
                      'bg-red-100 text-red-700': !result.success
                    }"
                  >
                    {{ result.success ? 'Success' : 'Failed' }}
                  </span>
                </div>
                <div v-if="result.result" class="mt-2 text-sm text-gray-600">
                  <pre class="bg-gray-50 p-2 rounded overflow-x-auto">{{ JSON.stringify(result.result, null, 2) }}</pre>
                </div>
                <p v-if="result.executedAt" class="mt-1 text-xs text-gray-500">
                  {{ new Date(result.executedAt).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Input Form -->
      <div v-if="isWaitingInput && pendingInputSchema" class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">User Input Required</h2>

        <form @submit.prevent="handleSubmitInput" class="space-y-4">
          <div
            v-for="field in pendingInputSchema.fields"
            :key="field.id"
            class="space-y-2"
          >
            <label :for="field.id" class="block text-sm font-medium text-gray-700">
              {{ field.label }}
              <span v-if="field.required" class="text-red-600">*</span>
            </label>

            <!-- Text Input -->
            <input
              v-if="field.type === 'text'"
              :id="field.id"
              v-model="inputData[field.id]"
              type="text"
              :required="field.required"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <!-- Number Input -->
            <input
              v-else-if="field.type === 'number'"
              :id="field.id"
              v-model.number="inputData[field.id]"
              type="number"
              :required="field.required"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <!-- Date Input -->
            <input
              v-else-if="field.type === 'date'"
              :id="field.id"
              v-model="inputData[field.id]"
              type="date"
              :required="field.required"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <!-- Select Dropdown -->
            <select
              v-else-if="field.type === 'select'"
              :id="field.id"
              v-model="inputData[field.id]"
              :required="field.required"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an option</option>
              <option v-for="option in field.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="flex space-x-3 pt-4">
            <button
              type="submit"
              :disabled="submitting"
              class="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ submitting ? 'Submitting...' : 'Submit' }}
            </button>
            <button
              type="button"
              @click="resetInput"
              class="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <!-- Final Result -->
      <div v-if="isCompleted && finalResult" class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center mb-4">
          <div
            class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full"
            :class="{
              'bg-green-100': finalResult.success,
              'bg-red-100': !finalResult.success
            }"
          >
            <svg
              v-if="finalResult.success"
              class="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg
              v-else
              class="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div class="ml-4">
            <h2 class="text-lg font-semibold" :class="{
              'text-green-900': finalResult.success,
              'text-red-900': !finalResult.success
            }">
              {{ finalResult.success ? 'Execution Completed' : 'Execution Failed' }}
            </h2>
          </div>
        </div>

        <div v-if="finalResult.error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm font-medium text-red-800">Error:</p>
          <p class="text-sm text-red-700 mt-1">{{ finalResult.error }}</p>
        </div>

        <div class="mt-6">
          <button
            @click="$router.push('/plans')"
            class="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Back to Plans
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const sessionStore = useSessionStore()

const {
  currentSessionId,
  status,
  isExecuting,
  currentStep,
  stepResults,
  finalResult,
  pendingInputSchema,
  error,
  loading,
  isWaitingInput,
  isCompleted
} = storeToRefs(sessionStore)

const inputData = ref<Record<string, any>>({})
const submitting = ref(false)

const statusLabel = computed(() => {
  switch (status.value) {
    case 'pending': return 'Pending'
    case 'executing': return 'Executing'
    case 'waiting_input': return 'Waiting for Input'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
})

const progressPercentage = computed(() => {
  // Simple progress calculation based on current step
  // In a real app, you'd calculate based on total steps
  return Math.min(currentStep.value * 10, 90)
})

async function handleSubmitInput() {
  if (!pendingInputSchema.value) return

  submitting.value = true
  try {
    await sessionStore.submitInput(inputData.value)
    inputData.value = {}
  } catch (err) {
    console.error('Failed to submit input:', err)
    alert('Failed to submit input: ' + (err instanceof Error ? err.message : 'Unknown error'))
  } finally {
    submitting.value = false
  }
}

function resetInput() {
  inputData.value = {}
}

onMounted(async () => {
  const sessionId = route.params.sessionId as string

  // If this is not the current session, load it
  if (currentSessionId.value !== sessionId) {
    try {
      await sessionStore.loadSession(sessionId)

      // If the session is still executing, connect to SSE
      if (status.value === 'executing' || status.value === 'waiting_input') {
        sessionStore.connectSSE(sessionId)
      }
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }
})

onUnmounted(() => {
  // Don't disconnect SSE here as the session might still be running
  // The user might navigate back and forth
})
</script>
