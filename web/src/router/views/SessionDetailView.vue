<template>
  <div class="session-detail-view">
    <header class="header">
      <button class="back-btn" @click="goBack">
        ← 返回列表
      </button>
      <h1>会话详情</h1>
      <p class="subtitle">会话: {{ sessionId }}</p>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-section">
      <A2UIProgress :component="{ id: 'loading', component: { Progress: { value: -1, label: loadingLabel } } }" />
    </div>

    <!-- Not found -->
    <div v-else-if="!session" class="not-found">
      <A2UICard :component="{ id: 'not-found', component: { Card: { title: '会话未找到' } } }">
        <template #default>
          <p>找不到指定的会话</p>
          <A2UIButton
            :component="{
              id: 'back-btn',
              component: { Button: { label: '返回列表', action: 'back', variant: 'secondary' } }
            }"
            @click="goBack"
          />
        </template>
      </A2UICard>
    </div>

    <template v-else>
      <!-- Status overview -->
      <div class="status-section">
        <A2UICard :component="{ id: 'status', component: { Card: { title: '执行状态', children: ['status-content'] } } }">
          <template #default>
            <div id="status-content" class="status-content">
              <div class="status-header">
                <A2UIBadge
                  :component="{
                    id: 'status-badge',
                    component: {
                      Badge: {
                        text: getStatusText(session.status),
                        variant: getStatusVariant(session.status)
                      }
                    }
                  }"
                />
                <span class="session-time">
                  步骤 {{ session.currentStepId }}/{{ session.stepCount }}
                </span>
              </div>
              <div class="time-info">
                <p>创建: {{ formatTime(session.createdAt) }}</p>
                <p>更新: {{ formatTime(session.updatedAt) }}</p>
              </div>
            </div>
          </template>
        </A2UICard>
      </div>

      <!-- Plan flowchart with Mermaid -->
      <div class="flowchart-section">
        <A2UICard :component="{ id: 'flowchart', component: { Card: { title: '执行流程', children: ['flowchart-container'] } } }">
          <template #default>
            <div id="flowchart-container" class="flowchart-container">
              <div ref="mermaidContainer" class="mermaid" v-html="mermaidHtml"></div>
            </div>
          </template>
        </A2UICard>
      </div>

      <!-- Step results -->
      <div class="steps-section">
        <A2UICard :component="{ id: 'steps', component: { Card: { title: '执行步骤', children: ['steps-list'] } } }">
          <template #default>
            <div id="steps-list" class="steps-list">
              <div v-for="(step, index) in plan?.steps" :key="step.stepId" class="step-item">
                <div class="step-header">
                  <span class="step-number">{{ index + 1 }}</span>
                  <span class="step-name">{{ getStepName(step) }}</span>
                  <A2UIBadge
                    :component="{
                      id: `step-status-${step.stepId}`,
                      component: {
                        Badge: {
                          text: getStepStatus(step.stepId),
                          variant: getStepStatusVariant(step.stepId)
                        }
                      }
                    }"
                  />
                </div>
                <div class="step-details" v-if="getStepResult(step.stepId)">
                  <div v-if="step.type === 'function_call'" class="function-info">
                    <p><strong>函数:</strong> {{ step.functionName }}</p>
                    <p v-if="step.parameters"><strong>参数:</strong> {{ formatParameters(step.parameters) }}</p>
                    <p v-if="getStepResult(step.stepId)?.result !== undefined">
                      <strong>结果:</strong> {{ getStepResult(step.stepId)?.result }}
                    </p>
                    <p v-if="getStepResult(step.stepId)?.error" class="error">
                      <strong>错误:</strong> {{ getStepResult(step.stepId)?.error }}
                    </p>
                  </div>
                  <div v-else-if="step.type === 'user_input'" class="input-info">
                    <p><strong>输入:</strong> {{ JSON.stringify(getStepResult(step.stepId)?.values || {}) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </A2UICard>
      </div>

      <!-- Actions -->
      <div class="actions-section">
        <A2UIButton
          :component="{
            id: 'restart-btn',
            component: { Button: { label: '重新执行', action: 'restart', variant: 'primary' } }
          }"
          @click="restartSession"
        />
        <A2UIButton
          v-if="session.status === 'waiting_input'"
          :component="{
            id: 'continue-btn',
            component: { Button: { label: '继续输入', action: 'continue', variant: 'primary' } }
          }"
          @click="continueSession"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import mermaid from 'mermaid';
import A2UIProgress from '../../components/a2ui/A2UIProgress.vue';
import A2UICard from '../../components/a2ui/A2UICard.vue';
import A2UIBadge from '../../components/a2ui/A2UIBadge.vue';
import A2UIButton from '../../components/a2ui/A2UIButton.vue';

interface Step {
  stepId: number;
  type: string;
  functionName?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  dependsOn?: number[];
}

interface StepResult {
  stepId: number;
  type: string;
  functionName?: string;
  values?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  success: boolean;
}

interface SessionDetail {
  id: string;
  status: 'pending' | 'running' | 'waiting_input' | 'completed' | 'failed';
  currentStepId: number;
  stepCount: number;
  stepResults: StepResult[];
  plan: {
    id: string;
    userRequest: string;
    steps: Step[];
  };
  pendingInput: {
    surfaceId: string;
    stepId: number;
    schema: any;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const loadingLabel = ref('加载会话详情...');
const session = ref<SessionDetail | null>(null);
const sessionId = computed(() => route.params.id as string);
const mermaidContainer = ref<HTMLElement | null>(null);

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  flowchart: {
    curve: 'basis',
    useMaxWidth: true,
  },
});

const plan = computed(() => session.value?.plan);
const stepResults = computed(() => session.value?.stepResults || []);

const mermaidHtml = computed(() => {
  if (!plan.value) return '';

  let graph = 'flowchart TD\n';
  graph += '    start((开始)) --> plan\n';
  graph += `    plan["${plan.value.userRequest}"]\n`;

  let lastNode = 'plan';

  for (const step of plan.value.steps) {
    const nodeId = `step${step.stepId}`;
    const label = step.functionName || step.type;
    const status = getStepStatus(step.stepId);
    const color = getMermaidColor(status);

    graph += `    ${lastNode} --> ${nodeId}["${label}"]\n`;
    graph += `    style ${nodeId} fill:${color}\n`;

    // Add result annotation
    const result = getStepResult(step.stepId);
    if (result) {
      if (result.success && result.result !== undefined) {
        graph += `    ${nodeId} --> result${step.stepId}["= ${JSON.stringify(result.result)}"]\n`;
      } else if (!result.success && result.error) {
        graph += `    ${nodeId} --> error${step.stepId}["✗ ${result.error}"]\n`;
      }
    }

    lastNode = nodeId;
  }

  graph += `    ${lastNode} --> end((完成))\n`;

  try {
    const { svg } = mermaid.render(`flowchart-${sessionId.value}`, graph);
    return svg;
  } catch {
    return `<pre>${graph}</pre>`;
  }
});

onMounted(async () => {
  await loadSession();
});

watch(mermaidHtml, async () => {
  if (mermaidHtml.value) {
    await nextTick();
  }
});

async function loadSession() {
  loading.value = true;
  loadingLabel.value = '加载会话详情...';

  try {
    const response = await fetch(`/api/session/${sessionId.value}`);
    const result = await response.json();

    if (result.success && result.session) {
      session.value = result.session;
    } else {
      session.value = null;
    }
  } catch (error) {
    console.error('Failed to load session:', error);
    session.value = null;
  } finally {
    loading.value = false;
    loadingLabel.value = '';
  }
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    waiting_input: '等待输入',
    completed: '已完成',
    failed: '失败',
  };
  return statusMap[status] || status;
}

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' {
  const variantMap: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
    pending: 'info',
    running: 'info',
    waiting_input: 'warning',
    completed: 'success',
    failed: 'error',
  };
  return variantMap[status] || 'info';
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getStepName(step: Step): string {
  if (step.functionName) return step.functionName;
  if (step.type === 'user_input') return '用户输入';
  if (step.type === 'function_call') return '函数调用';
  return step.description || `步骤 ${step.stepId}`;
}

function getStepResult(stepId: number): StepResult | undefined {
  return stepResults.value.find(r => r.stepId === stepId);
}

function getStepStatus(stepId: number): string {
  const result = getStepResult(stepId);
  if (!result) {
    // Check if step is pending (not yet executed)
    if (session.value && stepId >= session.value.currentStepId) {
      return 'pending';
    }
    return 'pending';
  }
  return result.success ? 'success' : 'failed';
}

function getStepStatusVariant(stepId: number): 'success' | 'warning' | 'error' | 'info' {
  const status = getStepStatus(stepId);
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  return 'info';
}

function getMermaidColor(status: string): string {
  const colorMap: Record<string, string> = {
    success: '#10b981',
    failed: '#ef4444',
    pending: '#6b7280',
    running: '#3b82f6',
  };
  return colorMap[status] || '#6b7280';
}

function formatParameters(params: Record<string, unknown>): string {
  const entries = Object.entries(params).map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return `${key}: ${JSON.stringify(value)}`;
    }
    return `${key}: ${value}`;
  });
  return entries.join(', ');
}

function goBack() {
  router.push('/sessions');
}

function restartSession() {
  // TODO: Implement restart functionality
  alert('重新执行功能待实现');
}

function continueSession() {
  // TODO: Implement continue with input
  alert('继续输入功能待实现');
}
</script>

<style scoped>
.session-detail-view {
  padding-bottom: 40px;
}

.header {
  margin-bottom: 24px;
}

.back-btn {
  background: none;
  border: none;
  color: #60a5fa;
  cursor: pointer;
  font-size: 0.875rem;
  margin-bottom: 8px;
  padding: 0;
}

.back-btn:hover {
  text-decoration: underline;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.subtitle {
  color: #9ca3af;
  margin: 4px 0 0;
  font-family: monospace;
}

.loading-section {
  margin: 24px 0;
}

.not-found {
  text-align: center;
  color: #9ca3af;
}

.status-section {
  margin-bottom: 24px;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-info {
  font-size: 0.875rem;
  color: #9ca3af;
}

.time-info p {
  margin: 4px 0;
}

.flowchart-section {
  margin-bottom: 24px;
}

.flowchart-container {
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-x: auto;
}

.mermaid {
  width: 100%;
  text-align: center;
}

.mermaid :deep(svg) {
  max-width: 100%;
  height: auto;
}

.steps-section {
  margin-bottom: 24px;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.step-number {
  width: 28px;
  height: 28px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.step-name {
  font-weight: 500;
  flex: 1;
}

.step-details {
  padding-left: 40px;
  font-size: 0.875rem;
}

.function-info p,
.input-info p {
  margin: 4px 0;
}

.error {
  color: #ef4444;
}

.actions-section {
  display: flex;
  gap: 12px;
}
</style>
