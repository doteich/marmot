import { ref } from 'vue'
import type { SiteInfo } from '@/types/dashboard'

const sites = ref<SiteInfo[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

export function useSites() {
  /**
   * Fetch all registered sites from backend
   */
  async function fetchSites() {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch('/api/sites')
      if (!res.ok) {
        throw new Error(`Failed to load sites: ${res.statusText}`)
      }
      const data: SiteInfo[] = await res.json()
      sites.value = data || []
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      error.value = err
      console.error('[useSites] Error fetching sites:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new plant/site
   */
  async function createSite(payload: { id: string; name: string; description?: string; wsUrl: string }) {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to create site')
      }
      const created: SiteInfo = await res.json()
      // Refresh or prepend
      const existingIdx = sites.value.findIndex((s) => s.id === created.id)
      if (existingIdx >= 0) {
        sites.value[existingIdx] = created
      } else {
        sites.value.push(created)
      }
      return created
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      error.value = err
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update an existing plant/site
   */
  async function updateSite(id: string, payload: { name?: string; description?: string; wsUrl?: string }) {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to update site')
      }
      await fetchSites()
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      error.value = err
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a site by ID
   */
  async function deleteSite(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to delete site')
      }
      sites.value = sites.value.filter((s) => s.id !== id)
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e)
      error.value = err
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Test WebSocket gateway connection for a site
   */
  async function testSiteConnection(wsUrl: string): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    return new Promise((resolve) => {
      const start = performance.now()
      let settled = false

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          try {
            ws.close()
          } catch {
            // ignore
          }
          resolve({ success: false, error: 'Connection timed out (3s)' })
        }
      }, 3000)

      let ws: WebSocket
      try {
        ws = new WebSocket(wsUrl)
      } catch (err) {
        clearTimeout(timer)
        return resolve({ success: false, error: err instanceof Error ? err.message : 'Invalid WebSocket URL' })
      }

      ws.onopen = () => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          const latencyMs = Math.round(performance.now() - start)
          ws.close()
          resolve({ success: true, latencyMs })
        }
      }

      ws.onerror = () => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ success: false, error: 'Failed to establish WebSocket handshake' })
        }
      }
    })
  }

  return {
    sites,
    isLoading,
    error,
    fetchSites,
    createSite,
    updateSite,
    deleteSite,
    testSiteConnection,
  }
}
