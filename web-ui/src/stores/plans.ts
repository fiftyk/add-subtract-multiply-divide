import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { plansApi, sessionsApi } from '../services/api'
import type { Plan, SessionSummary } from '../types'

export const usePlansStore = defineStore('plans', () => {
  // State
  const plans = ref<Plan[]>([])
  const selectedPlan = ref<Plan | null>(null)
  const planSessions = ref<SessionSummary[]>([])
  const loading = ref(false)
  const sessionsLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const hasPlan = computed(() => plans.value.length > 0)
  const executablePlans = computed(() =>
    plans.value.filter(p => p.status === 'executable')
  )

  // Actions
  async function loadPlans() {
    loading.value = true
    error.value = null

    try {
      plans.value = await plansApi.list()
      console.log(`[PlansStore] Loaded ${plans.value.length} plans`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load plans'
      console.error('[PlansStore] Error loading plans:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadPlan(planId: string) {
    loading.value = true
    error.value = null

    try {
      selectedPlan.value = await plansApi.get(planId)
      console.log('[PlansStore] Loaded plan:', planId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load plan'
      console.error('[PlansStore] Error loading plan:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadPlanSessions(planId: string) {
    sessionsLoading.value = true
    error.value = null

    try {
      planSessions.value = await sessionsApi.list(planId)
      console.log(`[PlansStore] Loaded ${planSessions.value.length} sessions for plan:`, planId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load sessions'
      console.error('[PlansStore] Error loading sessions:', err)
      throw err
    } finally {
      sessionsLoading.value = false
    }
  }

  function selectPlan(plan: Plan | null) {
    selectedPlan.value = plan
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    plans,
    selectedPlan,
    planSessions,
    loading,
    sessionsLoading,
    error,

    // Getters
    hasPlan,
    executablePlans,

    // Actions
    loadPlans,
    loadPlan,
    loadPlanSessions,
    selectPlan,
    clearError
  }
})
