<template>
  <div id="app-container">
    <div v-if="!connected" class="connecting">
      <div class="loading-spinner"></div>
      <p>正在连接服务器...</p>
    </div>
    <div v-else class="main-content">
      <!-- Navigation -->
      <nav class="nav">
        <div class="nav-brand">fn-orchestrator</div>
        <div class="nav-links">
          <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
            首页
          </router-link>
          <router-link to="/plans" class="nav-link" :class="{ active: $route.path === '/plans' }">
            计划
          </router-link>
          <router-link to="/tools" class="nav-link" :class="{ active: $route.path === '/tools' }">
            工具
          </router-link>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="main">
        <router-view />
      </main>

      <!-- A2UI Components from SSE -->
      <A2UISurface
        v-for="surface in surfaces"
        :key="surface.id"
        :surface="surface"
        @action="handleAction"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { A2UIComponent, A2UIUserAction, A2UIServerMessage } from '../../../src/a2ui/types';
import A2UISurface from './components/a2ui/A2UISurface.vue';
import router from './router';

interface Surface {
  id: string;
  rootId: string;
  components: Map<string, A2UIComponent>;
  order: string[];
}

const surfaces = ref<Map<string, Surface>>(new Map());
const connected = ref(false);
let eventSource: EventSource | null = null;

onMounted(() => {
  connectSSE();
  surfaces.value.set('main', {
    id: 'main',
    rootId: 'root',
    components: new Map(),
    order: [],
  });
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});

function connectSSE() {
  eventSource = new EventSource('/sse/stream');

  eventSource.onopen = () => {
    connected.value = true;
  };

  eventSource.onmessage = (event) => {
    try {
      const message: A2UIServerMessage = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = () => {
    connected.value = false;
    eventSource?.close();
    setTimeout(connectSSE, 3000);
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

function handleAction(action: A2UIUserAction) {
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  }).catch(console.error);
}
</script>

<style scoped>
#app-container {
  min-height: 100vh;
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.main-content {
  color: white;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 24px;
}

.nav-brand {
  font-size: 1.25rem;
  font-weight: 600;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  color: #9ca3af;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-link.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.main {
  min-height: 400px;
}

.connecting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
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
