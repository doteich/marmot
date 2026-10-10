import { ref, computed } from 'vue'

export type UserRole = 'admin' | 'operator' | 'viewer'

export interface AuthUser {
  id: string
  name: string
  email: string
  roles: UserRole[]
  avatar?: string
}

// Global reactive authentication state
// Auth enforcement is OFF by default during testing, granting full admin permissions
const authEnforced = ref(false)
const isAuthenticated = ref(true)

const currentUser = ref<AuthUser>({
  id: 'dev-admin',
  name: 'Dev Administrator',
  email: 'admin@marmot.local',
  roles: ['admin'],
})

export function useAuth() {
  /**
   * Check if current user has a specific role (or bypass if authEnforced is false)
   */
  function hasRole(role: UserRole): boolean {
    if (!authEnforced.value) return true
    return currentUser.value.roles.includes(role)
  }

  const isAdmin = computed(() => hasRole('admin'))
  const isOperator = computed(() => hasRole('admin') || hasRole('operator'))
  const isViewer = computed(() => true)

  const canManageSites = computed(() => isAdmin.value)
  const canUploadExtensions = computed(() => isAdmin.value)
  const canEditDashboards = computed(() => isOperator.value)

  /**
   * Helper to switch test roles without needing full OIDC provider
   */
  function setTestingRole(role: UserRole) {
    currentUser.value.roles = [role]
    if (role === 'admin') {
      currentUser.value.name = 'Dev Administrator'
    } else if (role === 'operator') {
      currentUser.value.name = 'Plant Operator'
    } else {
      currentUser.value.name = 'Guest Viewer'
    }
  }

  /**
   * Toggle between testing mode (bypassed) and enforced mode
   */
  function toggleAuthEnforcement() {
    authEnforced.value = !authEnforced.value
  }

  /**
   * Placeholder for future Keycloak / Authentik / OIDC redirect login
   */
  async function login() {
    console.info('[useAuth] OIDC Login initiated (stub)')
    isAuthenticated.value = true
  }

  /**
   * Placeholder for future OIDC logout
   */
  async function logout() {
    console.info('[useAuth] OIDC Logout initiated (stub)')
    isAuthenticated.value = false
  }

  return {
    authEnforced,
    isAuthenticated,
    currentUser,
    isAdmin,
    isOperator,
    isViewer,
    canManageSites,
    canUploadExtensions,
    canEditDashboards,
    hasRole,
    setTestingRole,
    toggleAuthEnforcement,
    login,
    logout,
  }
}
