<template>
  <div class="flex flex-col lg:flex-row gap-6 items-start">
    <div class="flex-1 min-w-0">
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
    <div v-else class="flex-1 min-w-0 space-y-6">
      <!-- Status Header -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Execution Progress</h1>
            <p class="text-sm text-gray-500 mt-1 font-mono">Session: {{ currentSessionId }}</p>
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
      <div v-if="stepResults.length > 0" class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed Steps
            <span class="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ stepResults.length }}
            </span>
          </h2>
        </div>

        <div class="p-4 space-y-3">
          <div
            v-for="result in stepResults"
            :key="result.stepId"
            class="group border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all duration-200"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors"
                :class="{
                  'bg-green-100 text-green-800 group-hover:bg-green-200': result.success,
                  'bg-red-100 text-red-800 group-hover:bg-red-200': !result.success
                }"
              >
                <svg v-if="result.success" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-2">
                  <span class="text-sm font-medium text-gray-900">
                    {{ result.type === 'function_call' ? 'Function Call' : 'User Input' }}
                  </span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded"
                    :class="{
                      'bg-green-100 text-green-700': result.success,
                      'bg-red-100 text-red-700': !result.success
                    }"
                  >
                    {{ result.success ? 'Success' : 'Failed' }}
                  </span>
                  <span class="text-xs text-gray-400">Step {{ result.stepId }}</span>
                </div>
                <div v-if="result.result" class="mt-2 text-sm">
                  <div class="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                    <pre class="text-gray-100 text-xs font-mono">{{ JSON.stringify(result.result, null, 2) }}</pre>
                  </div>
                </div>
                <p v-if="result.executedAt" class="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ new Date(result.executedAt).toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- A2UI Surface Updates (Real-time Results) -->
      <div v-if="surfaceUpdates.length > 0" class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Execution Results
          </h2>
        </div>

        <div class="p-6 space-y-4">
          <div
            v-for="update in surfaceUpdates"
            :key="update.surfaceId"
            class="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <A2UIRenderer :components="update.components" />
          </div>
        </div>
      </div>

      <!-- User Input Form -->
      <div v-if="isWaitingInput && pendingInputSchema" class="bg-white rounded-xl shadow-lg border border-gray-100">
        <!-- Header with icon -->
        <div class="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">User Input Required</h2>
              <p class="text-sm text-gray-500">Please fill in the information below</p>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSubmitInput" class="p-6 space-y-5">
          <div
            v-for="field in pendingInputSchema.fields"
            :key="field.id"
            class="space-y-2"
          >
            <label :for="field.id" class="flex items-center gap-1 text-sm font-medium text-gray-700">
              {{ field.label }}
              <span v-if="field.required" class="text-red-500">*</span>
            </label>

            <!-- Text Input (A2UI v0.8) -->
            <textarea
              v-if="field.type === 'text' && field.config?.multiline"
              :id="field.id"
              v-model="inputData[field.id]"
              :required="field.required"
              :rows="field.config?.rows || 3"
              :placeholder="field.config?.placeholder"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            ></textarea>
            <input
              v-else-if="field.type === 'text'"
              :id="field.id"
              v-model="inputData[field.id]"
              type="text"
              :required="field.required"
              :placeholder="field.config?.placeholder"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />

            <!-- Number Input (A2UI v0.8 - validation.range) -->
            <input
              v-else-if="field.type === 'number'"
              :id="field.id"
              v-model.number="inputData[field.id]"
              type="number"
              :required="field.required"
              :min="field.validation?.range?.min"
              :max="field.validation?.range?.max"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />

            <!-- Boolean Input (A2UI v0.8 - checkbox) -->
            <div v-else-if="field.type === 'boolean'" class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                :id="field.id"
                type="checkbox"
                v-model="inputData[field.id]"
                :required="field.required"
                class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label :for="field.id" class="text-sm text-gray-700">
                {{ field.description || field.label }}
              </label>
            </div>

            <!-- Date Input (A2UI v0.8) -->
            <input
              v-else-if="field.type === 'date'"
              :id="field.id"
              v-model="inputData[field.id]"
              type="date"
              :required="field.required"
              :min="field.config?.minDate"
              :max="field.config?.maxDate"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />

            <!-- Single Select (A2UI v0.8 - dropdown) -->
            <select
              v-else-if="field.type === 'single_select'"
              :id="field.id"
              v-model="inputData[field.id]"
              :required="field.required"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option value="">{{ field.config?.placeholder || `请选择${field.label}` }}</option>
              <option
                v-for="option in field.config?.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- Multi Select (A2UI v0.8 - multiple dropdown) -->
            <select
              v-else-if="field.type === 'multi_select'"
              :id="field.id"
              v-model="inputData[field.id]"
              :required="field.required"
              multiple
              :size="Math.min(field.config?.options?.length || 5, 5)"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option
                v-for="option in field.config?.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3 pt-4 mt-6 border-t border-gray-100">
            <button
              type="submit"
              :disabled="submitting"
              class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="!submitting" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ submitting ? 'Submitting...' : 'Submit' }}
            </button>
            <button
              type="button"
              @click="resetInput"
              class="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:ring-4 focus:ring-gray-200 transition-all duration-200"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <!-- Final Result -->
      <div v-if="isCompleted && finalResult" class="bg-white rounded-xl shadow-lg border overflow-hidden">
        <!-- Header with gradient background -->
        <div
          class="px-6 py-4 flex items-center gap-4"
          :class="finalResult.success
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100'
            : 'bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100'"
        >
          <div
            class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full"
            :class="finalResult.success ? 'bg-green-100' : 'bg-red-100'"
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
          <div>
            <h2 class="text-lg font-semibold" :class="finalResult.success ? 'text-green-900' : 'text-red-900'">
              {{ finalResult.success ? 'Execution Completed Successfully!' : 'Execution Failed' }}
            </h2>
            <p v-if="finalResult.success" class="text-sm text-green-700">All steps completed without errors</p>
          </div>
        </div>

        <div class="p-6">
          <div v-if="finalResult.error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2 text-red-800 font-medium mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Error Details
            </div>
            <p class="text-sm text-red-700 font-mono">{{ finalResult.error }}</p>
          </div>

          <div class="flex gap-3">
            <button
              @click="$router.push('/plans')"
              class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Plans
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sidebar Summary -->
    <aside v-if="sidebarVisible" class="w-72 flex-shrink-0 sticky top-4 hidden lg:block">
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Summary
          </h3>
        </div>

        <div class="p-4 space-y-4">
          <!-- Progress Summary -->
          <div v-if="isWaitingInput">
            <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Progress</div>
            <A2UIRenderer :components="inputComponents" />
          </div>

          <!-- User Input Summary -->
          <div v-if="userInputSummary.length > 0">
            <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Filled Information</div>
            <div class="space-y-2">
              <div
                v-for="(item, index) in userInputSummary"
                :key="index"
                class="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
              >
                <span class="text-gray-600">{{ item.label }}</span>
                <span class="font-medium text-gray-900 truncate max-w-32" :title="String(item.value)">
                  {{ formatSummaryValue(item.value) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Latest Function Result -->
          <div v-if="latestFunctionResult">
            <div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Latest Result</div>
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 text-xs font-mono overflow-y-auto max-h-40 border border-gray-200">
              <pre>{{ JSON.stringify(latestFunctionResult, null, 2) }}</pre>
            </div>
          </div>

          <!-- Step Count -->
          <div class="pt-3 border-t border-gray-100">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500">Steps</span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {{ stepCountText }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '../stores/session'
import A2UIRenderer from '../components/A2UIRenderer.vue'
import type { A2UIComponent } from '../types'

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
  surfaceUpdates,
  error,
  loading,
  isWaitingInput,
  isCompleted,
  totalSteps,
  totalUserInputSteps,
  completedSteps,
  completedUserInputSteps
} = storeToRefs(sessionStore)

const inputData = ref<Record<string, any>>({})
const submitting = ref(false)

// Input components from inputRequested event (Progress, Card, etc.)
const inputComponents = computed(() => {
  return sessionStore.lastInputRequested?.components ?? []
})

// Sidebar visibility
const sidebarVisible = computed(() => {
  return isWaitingInput.value || stepResults.value.length > 0
})

// Check if plan has user input steps
const hasUserInputSteps = computed(() => {
  return totalUserInputSteps.value > 0
})

// Step count display: use user input steps if available, otherwise use total steps
const stepCountText = computed(() => {
  if (hasUserInputSteps.value) {
    return `${completedUserInputSteps.value} / ${totalUserInputSteps.value}`
  }
  return `${completedSteps.value} / ${totalSteps.value}`
})

// User input summary (from previous user input steps)
const userInputSummary = computed(() => {
  const summary: Array<{ label: string; value: unknown }> = []

  // Get all user input results - user input steps store data in 'values' field
  const userInputResults = stepResults.value
    .filter(s => s.type === 'user_input' && (s as any).values)
    .sort((a, b) => a.stepId - b.stepId)

  for (const result of userInputResults) {
    const values = (result as any).values
    if (values && typeof values === 'object') {
      for (const [key, value] of Object.entries(values)) {
        // Skip internal fields
        if (key.startsWith('_')) continue
        summary.push({
          label: key,
          value
        })
      }
    }
  }

  return summary
})

// Latest function call result
const latestFunctionResult = computed(() => {
  const functionResults = stepResults.value
    .filter(s => s.type === 'function_call' && s.result)
    .sort((a, b) => a.stepId - b.stepId)

  const last = functionResults[functionResults.length - 1]
  return last?.result ?? null
})

// Format summary value for display
function formatSummaryValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

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
