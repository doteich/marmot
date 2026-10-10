import { createRouter, createWebHistory } from 'vue-router'
import DesignerView from '@/views/DesignerView.vue'
import { useAuth } from '@/composables/useAuth'

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
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/viewer/:id',
      name: 'viewer',
      component: () => import('@/views/ViewerView.vue'),
    },
  ],
})

// RBAC Navigation Guard (Prepared for OIDC)
// During current testing phase, authEnforced is false by default so access is completely open.
router.beforeEach((to, _from, next) => {
  const { authEnforced, isAuthenticated, isAdmin } = useAuth()

  if (authEnforced.value && to.meta.requiresAdmin) {
    if (!isAuthenticated.value || !isAdmin.value) {
      console.warn(`[RouteGuard] Access to ${to.path} blocked: Admin role required`)
      next({ path: '/designer' })
      return
    }
  }

  next()
})

export default router
