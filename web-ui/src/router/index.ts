import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    redirect: '/plans'
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('../views/PlanListView.vue'),
    meta: {
      title: 'Plans'
    }
  },
  {
    path: '/functions',
    name: 'functions',
    component: () => import('../views/FunctionsView.vue'),
    meta: {
      title: 'Functions'
    }
  },
  {
    path: '/plans/:id',
    name: 'plan-detail',
    component: () => import('../views/PlanDetailView.vue'),
    meta: {
      title: 'Plan Details'
    }
  },
  {
    path: '/execution/:sessionId',
    name: 'execution',
    component: () => import('../views/ExecutionView.vue'),
    meta: {
      title: 'Execution'
    }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  // Update document title
  document.title = to.meta.title
    ? `${to.meta.title} - fn-orchestrator`
    : 'fn-orchestrator'

  next()
})

export default router
