<template>
  <div class="home-view">
    <header class="header">
      <div class="header-top">
        <h1>fn-orchestrator</h1>
        <router-link to="/sessions" class="sessions-link">查看会话 →</router-link>
      </div>
      <p class="subtitle">基于 LLM 的函数编排系统</p>
    </header>

    <!-- Plan Input Form -->
    <div class="plan-form">
      <label class="input-label">请描述您的需求</label>
      <textarea
        v-model="userRequest"
        class="request-input"
        placeholder="例如：计算 (3 + 5) * 2"
        rows="3"
      ></textarea>
      <div class="form-actions">
        <button
          class="btn btn-primary"
          @click="createPlan"
          :disabled="!userRequest.trim() || loading"
        >
          生成计划
        </button>
        <button class="btn btn-secondary" @click="clearResults">清空</button>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="loading" class="loading-section">
      <A2UIProgress :component="{ id: 'loading', component: { Progress: { value: -1, label: loadingLabel } } }" />
    </div>

    <!-- Results -->
    <div v-if="planResult" class="result-section">
      <A2UICard
        :component="{
          id: 'plan-card',
          component: { Card: { title: `计划: ${planResult.id}`, children: [] } }
        }"
      >
        <template #default>
          <div class="plan-steps">
            <div v-for="(step, index) in planResult.steps" :key="index" class="step-item">
              <span class="step-number">{{ index + 1 }}</span>
              <span class="step-name">{{ getStepName(step) }}</span>
            </div>
          </div>
        </template>
      </A2UICard>

      <div class="execute-actions">
        <button
          class="btn btn-execute"
          @click="executePlan"
          :disabled="executing"
        >
          {{ executing ? '执行中...' : '执行计划' }}
        </button>
        <span v-if="executing" class="executing-hint">正在建立会话连接...</span>
      </div>
    </div>

    <!-- A2UI Components from SSE -->
    <A2UISurface
      v-for="[id, surface] in Array.from(surfaces.entries())"
      :key="id"
      :surface="surface"
      @action="handleAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { A2UIComponent, A2UIUserAction, A2UIServerMessage } from '../../../src/a2ui/types';
import A2UISurface from '../../components/a2ui/A2UISurface.vue';
import A2UIProgress from '../../components/a2ui/A2UIProgress.vue';
import A2UICard from '../../components/a2ui/A2UICard.vue';

interface Surface {
  id: string;
  rootId: string;
  components: Map<string, A2UIComponent>;
  order: string[];
}

interface PlanResult {
  id: string;
  steps: Array<{ functionName?: string; type: string; description?: string }>;
}

const surfaces = ref<Map<string, Surface>>(new Map());
const loading = ref(false);
const loadingLabel = ref('');
const userRequest = ref('');
const planResult = ref<PlanResult | null>(null);
const executionStatus = ref<'idle' | 'running' | 'completed' | 'failed'>('idle');
const executing = ref(false);

let eventSource: EventSource | null = null;
const route = useRoute();
const router = useRouter();

// Inject session connection from App.vue
const startSession = inject<(sessionId: string) => void>('startSession');

onMounted(async () => {
  connectSSE();
  surfaces.value.set('main', {
    id: 'main',
    rootId: 'root',
    components: new Map(),
    order: [],
  });

  // Check for planId in query params
  if (route.query.planId) {
    await loadPlanFromId(route.query.planId as string);
  }
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});

function connectSSE() {
  eventSource = new EventSource('/sse/stream');
  eventSource.onmessage = (event) => {
    try {
      const message: A2UIServerMessage = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };
}

function handleMessage(message: A2UIServerMessage) {
  switch (message.type) {
    case 'surfaceUpdate':
      const surface = surfaces.value.get(message.surfaceId);
      if (surface) {
        for (const comp of message.components) {
          surface.components.set(comp.id, comp);
          if (!surface.order.includes(comp.id)) {
            surface.order.push(comp.id);
          }
        }
        if (message.removeComponentIds) {
          for (const id of message.removeComponentIds) {
            surface.components.delete(id);
            surface.order = surface.order.filter(o => o !== id);
          }
        }
        surfaces.value = new Map(surfaces.value);
      }
      break;
  }
}

function getStepName(step: any): string {
  if (step.functionName) return step.functionName;
  if (step.type === 'user_input') return '用户输入';
  if (step.type === 'function_call') return '函数调用';
  return step.description || '未知步骤';
}

function handleAction(action: A2UIUserAction) {
  if (action.name === 'execute') {
    executePlan();
  } else if (action.name === 'clear') {
    clearResults();
  }
}

async function createPlan() {
  if (!userRequest.value.trim()) return;
  loading.value = true;
  loadingLabel.value = '正在生成计划...';
  planResult.value = null;

  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: userRequest.value }),
    });
    const result = await response.json();
    if (result.success) {
      planResult.value = result.plan;
    } else {
      alert(`生成计划失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Failed to create plan:', error);
    alert('生成计划失败');
  } finally {
    loading.value = false;
    loadingLabel.value = '';
  }
}

async function executePlan() {
  if (!planResult.value) return;
  executing.value = true;
  executionStatus.value = 'running';

  try {
    const response = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planData: {
          id: planResult.value.id,
          userRequest: userRequest.value || '计算需求',
          steps: planResult.value.steps,
          status: 'executable',
        },
      }),
    });
    const result = await response.json();

    if (result.success) {
      // Connect to session SSE to receive updates
      if (startSession) {
        startSession(result.sessionId);
      }
      // Navigate to session detail page
      router.push(`/sessions/${result.sessionId}`);
    } else {
      alert(`启动执行失败: ${result.error}`);
      executionStatus.value = 'failed';
      executing.value = false;
    }
  } catch (error) {
    console.error('Failed to execute plan:', error);
    alert('执行计划失败');
    executionStatus.value = 'failed';
    executing.value = false;
  }
}

function clearResults() {
  userRequest.value = '';
  planResult.value = null;
}

async function loadPlanFromId(id: string) {
  loading.value = true;
  loadingLabel.value = '加载计划...';

  try {
    const response = await fetch(`/api/plan/${id}`);
    const result = await response.json();

    if (result.success && result.plan) {
      planResult.value = {
        id: result.plan.id,
        steps: result.plan.steps,
      };
      userRequest.value = result.plan.userRequest;
    } else {
      alert(`加载计划失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Failed to load plan:', error);
    alert('加载计划失败');
  } finally {
    loading.value = false;
    loadingLabel.value = '';
  }
}
</script>

<style scoped>
.home-view {
  padding-bottom: 40px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header-top {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
}

.sessions-link {
  font-size: 0.875rem;
  color: #60a5fa;
  text-decoration: none;
  padding: 6px 12px;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 6px;
  transition: all 0.2s;
}

.sessions-link:hover {
  background: rgba(96, 165, 250, 0.2);
  color: #93c5fd;
}

.subtitle {
  color: #9ca3af;
  margin: 8px 0 0;
}

.plan-form {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.request-input {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  resize: vertical;
}

.request-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-execute {
  background: #10b981;
  color: white;
  width: 100%;
}

.loading-section {
  margin: 24px 0;
}

.result-section {
  margin-top: 24px;
}

.plan-steps {
  margin-top: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.step-number {
  width: 24px;
  height: 24px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  margin-right: 12px;
}

.execute-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.executing-hint {
  font-size: 0.875rem;
  color: #9ca3af;
}
</style>
