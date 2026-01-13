<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Functions</h1>
      <p class="text-gray-600">Browse and search available functions</p>
    </div>

    <!-- Search Bar -->
    <div class="mb-6">
      <div class="relative">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          type="text"
          placeholder="Search functions by name or description..."
          class="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          class="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <!-- Search Results Count -->
      <div v-if="searchQuery && searchResults" class="mt-2 text-sm text-gray-600">
        Found {{ searchResults.total }} function{{ searchResults.total !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Search Results -->
    <div v-else-if="searchQuery && searchResults">
      <div v-if="searchResults.functions.length === 0" class="text-center py-12">
        <p class="text-gray-500">No functions found matching "{{ searchQuery }}"</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="fn in searchResults.functions"
          :key="fn.name"
          class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 font-mono">{{ fn.name }}</h3>
              <p class="text-sm text-gray-500 mt-1">
                {{ fn.type === 'local' ? '🏠 Local' : '🔌 ' + fn.source }}
              </p>
            </div>
            <button
              @click="openExecuteDialog(fn)"
              class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Run
            </button>
          </div>
          <p class="text-gray-700 mb-2">{{ fn.description }}</p>
          <div v-if="fn.scenario" class="text-sm text-gray-600 mb-3">
            <span class="font-medium">Use case:</span> {{ fn.scenario }}
          </div>

          <!-- Parameters -->
          <div v-if="fn.parameters && fn.parameters.length > 0" class="mt-3">
            <div class="text-sm font-medium text-gray-700 mb-2">Parameters:</div>
            <div class="space-y-1">
              <div
                v-for="param in fn.parameters"
                :key="param.name"
                class="text-sm text-gray-600 pl-4"
              >
                <code class="text-blue-600 font-mono">{{ param.name }}</code>
                <span class="text-gray-500">: {{ param.type }}</span>
                <span v-if="param.description" class="text-gray-600"> - {{ param.description }}</span>
              </div>
            </div>
          </div>

          <!-- Returns -->
          <div v-if="fn.returns" class="mt-2 text-sm">
            <span class="font-medium text-gray-700">Returns:</span>
            <code class="text-green-600 font-mono ml-1">{{ fn.returns.type }}</code>
            <span v-if="fn.returns.description" class="text-gray-600"> - {{ fn.returns.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Categorized Functions -->
    <div v-else-if="!loading && categorized">
      <div v-if="categorized.length === 0" class="text-center py-12">
        <p class="text-gray-500">No functions available.</p>
      </div>
      <div v-else class="space-y-8">
        <div v-for="category in categorized" :key="category.category.id">
          <!-- Category Header -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">{{ category.category.icon }}</span>
              <div>
                <h2 class="text-2xl font-bold text-gray-900">{{ category.category.name }}</h2>
                <p v-if="category.category.description" class="text-sm text-gray-600">
                  {{ category.category.description }}
                </p>
              </div>
            </div>
            <span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              {{ category.functions.length }} function{{ category.functions.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Functions in Category -->
          <div class="grid gap-4 md:grid-cols-2">
            <div
              v-for="fn in category.functions"
              :key="fn.name"
              class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between mb-2">
                <h3 class="text-lg font-semibold text-gray-900 font-mono">{{ fn.name }}</h3>
                <button
                  @click="openExecuteDialog(fn)"
                  class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  Run
                </button>
              </div>
              <p class="text-gray-700 mb-2">{{ fn.description }}</p>
              <div v-if="fn.scenario" class="text-sm text-gray-600 mb-3">
                <span class="font-medium">Use case:</span> {{ fn.scenario }}
              </div>

              <!-- Parameters -->
              <div v-if="fn.parameters && fn.parameters.length > 0" class="mt-3">
                <div class="text-sm font-medium text-gray-700 mb-2">Parameters:</div>
                <div class="space-y-1">
                  <div
                    v-for="param in fn.parameters"
                    :key="param.name"
                    class="text-sm text-gray-600 pl-4"
                  >
                    <code class="text-blue-600 font-mono">{{ param.name }}</code>
                    <span class="text-gray-500">: {{ param.type }}</span>
                  </div>
                </div>
              </div>

              <!-- Returns -->
              <div v-if="fn.returns" class="mt-2 text-sm">
                <span class="font-medium text-gray-700">Returns:</span>
                <code class="text-green-600 font-mono ml-1">{{ fn.returns.type }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Dialog -->
    <div v-if="executeDialog.show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-900">Execute Function</h2>
            <button @click="closeExecuteDialog" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Function Info -->
          <div class="mb-4 p-3 bg-gray-50 rounded">
            <p class="font-mono font-semibold text-lg">{{ executeDialog.function?.name }}</p>
            <p class="text-gray-600 text-sm">{{ executeDialog.function?.description }}</p>
          </div>

          <!-- Error Message -->
          <div v-if="executeDialog.error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p class="text-red-800 text-sm">{{ executeDialog.error }}</p>
          </div>

          <!-- Success Result -->
          <div v-if="executeDialog.result !== null" class="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p class="text-green-800 text-sm font-medium mb-1">Result:</p>
            <pre class="text-green-700 text-sm overflow-x-auto">{{ formatResult(executeDialog.result) }}</pre>
            <p v-if="executeDialog.executionTime" class="text-green-600 text-xs mt-2">
              Execution time: {{ executeDialog.executionTime }}ms
            </p>
          </div>

          <!-- Parameters Form -->
          <form v-if="!executeDialog.result && !executeDialog.executing" @submit.prevent="executeFunction">
            <div v-if="executeDialog.function?.parameters?.length" class="space-y-3 mb-4">
              <div v-for="param in executeDialog.function.parameters" :key="param.name">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {{ param.name }}
                  <span class="text-gray-400 font-normal">({{ param.type }})</span>
                  <span v-if="param.required" class="text-red-500">*</span>
                </label>
                <input
                  v-model="executeDialog.params[param.name]"
                  :type="param.type === 'number' ? 'number' : 'text'"
                  :required="param.required"
                  :placeholder="param.description || `Enter ${param.name}`"
                  class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div v-else class="text-gray-500 text-sm mb-4">
              This function takes no parameters.
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                @click="closeExecuteDialog"
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="executeDialog.executing"
                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {{ executeDialog.executing ? 'Executing...' : 'Execute' }}
              </button>
            </div>
          </form>

          <!-- Executing State -->
          <div v-if="executeDialog.executing" class="text-center py-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p class="text-gray-600 mt-2">Executing {{ executeDialog.function?.name }}...</p>
          </div>

          <!-- Reset Button (after execution) -->
          <div v-if="executeDialog.result !== null" class="flex justify-end">
            <button
              @click="resetExecuteDialog"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Run Again
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface FunctionMetadata {
  name: string
  description: string
  scenario?: string
  type: 'local' | 'remote'
  source?: string
  parameters?: Array<{
    name: string
    type: string
    description?: string
    required?: boolean
  }>
  returns?: {
    type: string
    description?: string
  }
}

interface FunctionCategory {
  id: string
  name: string
  description?: string
  count: number
  icon?: string
}

interface CategorizedFunctions {
  category: FunctionCategory
  functions: FunctionMetadata[]
}

interface SearchResult {
  functions: FunctionMetadata[]
  total: number
}

interface ExecuteDialogState {
  show: boolean
  function: FunctionMetadata | null
  params: Record<string, string>
  executing: boolean
  result: unknown
  executionTime: number | null
  error: string | null
}

const API_BASE_URL = 'http://localhost:3000/api'

const loading = ref(false)
const error = ref<string | null>(null)
const categorized = ref<CategorizedFunctions[] | null>(null)
const searchQuery = ref('')
const searchResults = ref<SearchResult | null>(null)

const executeDialog = ref<ExecuteDialogState>({
  show: false,
  function: null,
  params: {},
  executing: false,
  result: null,
  executionTime: null,
  error: null,
})

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const loadCategorizedFunctions = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_BASE_URL}/functions/categorized`)
    if (!response.ok) {
      throw new Error(`Failed to load functions: ${response.statusText}`)
    }
    const data = await response.json()
    categorized.value = data.categorized || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error loading functions:', e)
  } finally {
    loading.value = false
  }
}

const searchFunctions = async (query: string) => {
  loading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_BASE_URL}/functions/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`)
    }
    const data = await response.json()
    searchResults.value = {
      functions: data.functions || [],
      total: data.total || 0
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error searching functions:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Clear search results if query is empty
  if (!searchQuery.value.trim()) {
    searchResults.value = null
    return
  }

  // Debounce search (300ms)
  searchTimeout = setTimeout(() => {
    searchFunctions(searchQuery.value.trim())
  }, 300)
}

const openExecuteDialog = (fn: FunctionMetadata) => {
  executeDialog.value = {
    show: true,
    function: fn,
    params: {},
    executing: false,
    result: null,
    executionTime: null,
    error: null,
  }
}

const closeExecuteDialog = () => {
  executeDialog.value.show = false
  executeDialog.value.function = null
  executeDialog.value.params = {}
  executeDialog.value.result = null
  executeDialog.value.executionTime = null
  executeDialog.value.error = null
}

const resetExecuteDialog = () => {
  executeDialog.value.params = {}
  executeDialog.value.result = null
  executeDialog.value.executionTime = null
  executeDialog.value.error = null
}

const formatResult = (result: unknown): string => {
  if (typeof result === 'object' && result !== null) {
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

const executeFunction = async () => {
  const fn = executeDialog.value.function
  if (!fn) return

  executeDialog.value.executing = true
  executeDialog.value.error = null
  executeDialog.value.result = null

  // Convert params to proper types
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(executeDialog.value.params)) {
    const paramDef = fn.parameters?.find(p => p.name === key)
    if (paramDef?.type === 'number') {
      params[key] = Number(value)
    } else if (paramDef?.type === 'boolean') {
      params[key] = value.toLowerCase() === 'true' || value.toLowerCase() === '1'
    } else {
      params[key] = value
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/functions/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fn.name,
        params,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Execution failed')
    }

    executeDialog.value.result = data.result
    executeDialog.value.executionTime = data.executionTime
  } catch (e) {
    executeDialog.value.error = e instanceof Error ? e.message : 'Unknown error'
    console.error('Error executing function:', e)
  } finally {
    executeDialog.value.executing = false
  }
}

onMounted(() => {
  loadCategorizedFunctions()
})
</script>
