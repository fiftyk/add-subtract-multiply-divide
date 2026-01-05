<template>
  <div class="tools-view">
    <header class="header">
      <h1>可用工具</h1>
      <p class="subtitle">系统中可用的函数和工具</p>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="tools.length === 0" class="empty-state">
      <div class="empty-icon">🔧</div>
      <h3>暂无工具</h3>
      <p>系统正在加载工具...</p>
    </div>

    <div v-else class="tools-list">
      <div v-for="(tool, index) in tools" :key="index" class="tool-card">
        <div class="tool-header">
          <h3 class="tool-name">{{ tool.name }}</h3>
          <span class="tool-type">{{ tool.type || '函数' }}</span>
        </div>
        <p class="tool-description">{{ tool.description || '暂无描述' }}</p>
        <div v-if="tool.parameters && tool.parameters.length > 0" class="tool-params">
          <h4>参数：</h4>
          <ul>
            <li v-for="param in tool.parameters" :key="param.name">
              <code>{{ param.name }}</code> ({{ param.type }}) - {{ param.description }}
            </li>
          </ul>
        </div>
        <div v-if="tool.returns" class="tool-returns">
          <h4>返回值：</h4>
          <p>{{ tool.returns.type }} - {{ tool.returns.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Tool {
  name: string;
  type?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
}

const tools = ref<Tool[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await fetch('/api/tools');
    const data = await response.json();
    tools.value = data.tools || [];
  } catch (error) {
    console.error('Failed to load tools:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.tools-view {
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
  margin: 0;
}

.tools-list {
  display: grid;
  gap: 16px;
}

.tool-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tool-name {
  margin: 0;
  font-size: 1.125rem;
}

.tool-type {
  font-size: 0.75rem;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-radius: 4px;
}

.tool-description {
  color: #9ca3af;
  margin: 0 0 16px;
}

.tool-params, .tool-returns {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-params h4, .tool-returns h4 {
  margin: 0 0 8px;
  font-size: 0.875rem;
  color: #9ca3af;
}

.tool-params ul {
  margin: 0;
  padding-left: 20px;
}

.tool-params li {
  margin: 4px 0;
  font-size: 0.875rem;
}

.tool-params code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.tool-returns p {
  margin: 0;
  font-size: 0.875rem;
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
