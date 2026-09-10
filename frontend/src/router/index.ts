import { createRouter, createWebHistory } from 'vue-router'
import DesignerView from '@/views/DesignerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/designer',
    },
    {
      path: '/designer',
      name: 'designer',
      component: DesignerView,
    },
    {
      path: '/viewer/:id',
      name: 'viewer',
      component: () => import('@/views/ViewerView.vue'),
    },
  ],
})

export default router
