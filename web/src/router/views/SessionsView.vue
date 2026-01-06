<template>
  <div class="sessions-view">
    <header class="header">
      <h1>执行会话</h1>
      <p class="subtitle">查看和管理所有执行会话</p>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-section">
      <A2UIProgress :component="{ id: 'loading', component: { Progress: { value: -1, label: loadingLabel } } }" />
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="empty-state">
      <A2UICard :component="{ id: 'empty', component: { Card: { title: '暂无会话' } } }">
        <template #default>
          <p>还没有任何执行会话</p>
          <p class="hint">从首页生成计划并执行后，将在这里显示</p>
        </template>
      </A2UICard>
    </div>

    <!-- Sessions list -->
    <div v-else class="sessions-list">
      <A2UICard
        v-for="session in sessions"
        :key="session.id"
        :component="{
          id: session.id,
          component: { Card: { title: `会话: ${session.id}`, children: [`session-${session.id}-info`] } }
        }"
      >
        <template #default>
          <div :id="`session-${session.id}-info`" class="session-info">
            <div class="session-header">
              <A2UIBadge
                :component="{
                  id: `status-${session.id}`,
                  component: {
                    Badge: {
                      text: getStatusText(session.status),
                      variant: getStatusVariant(session.status)
                    }
                  }
                }"
              />
              <span class="session-time">{{ formatTime(session.createdAt) }}</span>
            </div>
            <div class="session-meta">
              <span>步骤: {{ session.currentStepId }}/{{ session.stepCount }}</span>
              <span v-if="session.updatedAt !== session.createdAt">
                更新: {{ formatTime(session.updatedAt) }}
              </span>
            </div>
            <div class="session-actions">
              <A2UIButton
                :component="{
                  id: `view-${session.id}`,
                  component: { Button: { label: '查看详情', action: `view-session-${session.id}`, variant: 'secondary' } }
                }"
                @click="viewSession(session.id)"
              />
            </div>
          </div>
        </template>
      </A2UICard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import A2UIProgress from '../../components/a2ui/A2UIProgress.vue';
import A2UICard from '../../components/a2ui/A2UICard.vue';
import A2UIBadge from '../../components/a2ui/A2UIBadge.vue';
import A2UIButton from '../../components/a2ui/A2UIButton.vue';

interface SessionSummary {
  id: string;
  status: 'pending' | 'running' | 'waiting_input' | 'completed' | 'failed';
  currentStepId: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

const router = useRouter();
const loading = ref(true);
const loadingLabel = ref('加载会话列表...');
const sessions = ref<SessionSummary[]>([]);

onMounted(async () => {
  await loadSessions();
});

async function loadSessions() {
  loading.value = true;
  loadingLabel.value = '加载会话列表...';

  try {
    const response = await fetch('/api/sessions');
    const result = await response.json();

    if (result.success) {
      sessions.value = result.sessions;
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
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
  });
}

function viewSession(sessionId: string) {
  router.push(`/sessions/${sessionId}`);
}
</script>

<style scoped>
.sessions-view {
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

.loading-section {
  margin: 24px 0;
}

.empty-state {
  text-align: center;
  color: #9ca3af;
}

.hint {
  font-size: 0.875rem;
  margin-top: 8px;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-time {
  font-size: 0.875rem;
  color: #9ca3af;
}

.session-meta {
  display: flex;
  gap: 16px;
  font-size: 0.875rem;
  color: #9ca3af;
}

.session-actions {
  margin-top: 8px;
}
</style>
