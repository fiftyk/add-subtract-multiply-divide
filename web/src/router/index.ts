import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import PlansView from './views/PlansView.vue';
import ToolsView from './views/ToolsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/plans',
      name: 'plans',
      component: PlansView,
    },
    {
      path: '/tools',
      name: 'tools',
      component: ToolsView,
    },
  ],
});

export default router;
