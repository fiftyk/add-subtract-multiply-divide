<template>
  <div class="plans-view">
    <header class="header">
      <h1>执行计划</h1>
      <p class="subtitle">管理和执行您的计划</p>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="plans.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>暂无计划</h3>
      <p>您还没有创建任何计划</p>
      <router-link to="/" class="btn btn-primary">创建计划</router-link>
    </div>

    <div v-else class="plans-list">
      <div v-for="plan in plans" :key="plan.id" class="plan-card">
        <div class="plan-header">
          <span class="plan-id">{{ plan.id }}</span>
          <span :class="['status-badge', plan.status]">{{ getStatusText(plan.status) }}</span>
        </div>
        <p class="plan-request">{{ plan.userRequest }}</p>
        <div class="plan-meta">
          <span>{{ plan.steps.length }} 个步骤</span>
          <span>{{ formatDate(plan.createdAt) }}</span>
        </div>
        <div class="plan-actions">
          <button class="btn btn-primary" @click="viewPlan(plan)">查看详情</button>
          <button
            class="btn btn-execute"
            @click="executePlan(plan)"
            :disabled="plan.status !== 'executable'"
          >
            执行
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface Plan {
  id: string;
  userRequest: string;
  steps: Array<{ functionName?: string; type: string }>;
  status: string;
  createdAt: string;
}

const router = useRouter();
const plans = ref<Plan[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await fetch('/api/plans');
    const data = await response.json();
    plans.value = data.plans || [];
  } catch (error) {
    console.error('Failed to load plans:', error);
  } finally {
    loading.value = false;
  }
});

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待执行',
    executable: '可执行',
    incomplete: '不完整',
  };
  return statusMap[status] || status;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function viewPlan(plan: Plan) {
  // Navigate to home with plan details
  router.push({ path: '/', query: { planId: plan.id } });
}

async function executePlan(plan: Plan) {
  try {
    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: plan.id,
        planData: plan,
      }),
    });
    const result = await response.json();
    if (!result.success) {
      alert(`执行失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Failed to execute plan:', error);
    alert('执行失败');
  }
}
</script>

<style scoped>
.plans-view {
  padding-bottom: 40px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
}

.subtitle {
  color: #9ca3af;
  margin: 8px 0 0;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #9ca3af;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 1.25rem;
}

.empty-state p {
  color: #9ca3af;
  margin: 0 0 24px;
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plan-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plan-id {
  font-family: monospace;
  font-size: 0.875rem;
  color: #9ca3af;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.pending {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.status-badge.executable {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-badge.incomplete {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.plan-request {
  margin: 0 0 12px;
  font-size: 1rem;
}

.plan-meta {
  display: flex;
  gap: 16px;
  font-size: 0.875rem;
  color: #9ca3af;
  margin-bottom: 16px;
}

.plan-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-execute {
  background: #10b981;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
