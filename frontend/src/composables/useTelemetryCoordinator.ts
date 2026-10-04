import { ref, reactive, computed, type Ref } from 'vue'
import type { HistoryPoint, HistoryResponse } from './useHistoricalTelemetry'

// Module-level singleton state for the dashboard data coordinator
const seriesCache = reactive<Record<string, HistoryPoint[]>>({})
const metadataCache = reactive<Record<string, { name?: string; unit?: string; machineId?: string }>>({})
const subscriptions = new Map<string, Set<string>>() // datapointId -> Set<widgetId>
const isLoading = ref(false)
const lastFetched = ref<Date | null>(null)
const timeRange = ref<string>('1h') // '15m', '1h', '6h', '8h', '24h', '7d'
const refreshIntervalSeconds = ref<number>(0) // 0 = off (default in designer)

let batchTimer: ReturnType<typeof setTimeout> | null = null
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

async function executeBatchFetch() {
  const activeDatapointIds = Array.from(subscriptions.keys()).filter((id) => {
    const subs = subscriptions.get(id)
    return subs && subs.size > 0
  })

  if (activeDatapointIds.length === 0) {
    return
  }

  isLoading.value = true

  try {
    const params = new URLSearchParams()
    // Join all subscribed datapoint IDs for a single batched HTTP request
    params.set('datapointId', activeDatapointIds.join(','))
    params.set('from', timeRange.value)
    params.set('bucket', 'auto')

    const res = await fetch(`/api/telemetry/history?${params.toString()}`)
    if (res.ok) {
      const data: HistoryResponse = await res.json()
      if (data && data.series) {
        for (const s of data.series) {
          seriesCache[s.dataPointId] = s.points || []
          metadataCache[s.dataPointId] = {
            name: s.dataPointName,
            unit: s.unit,
            machineId: s.machineId,
          }
        }
      }
      lastFetched.value = new Date()
    }
  } catch (err) {
    console.warn('[Coordinator] Batch fetch failed:', err)
  } finally {
    isLoading.value = false
  }
}

/**
 * Schedule a debounced batch fetch so multiple mounting widgets are coalesced into 1 request
 */
function scheduleBatchFetch(delayMs = 50) {
  if (batchTimer) {
    clearTimeout(batchTimer)
  }
  batchTimer = setTimeout(() => {
    executeBatchFetch()
  }, delayMs)
}

function configureAutoRefresh(seconds: number) {
  refreshIntervalSeconds.value = seconds
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  if (seconds > 0) {
    autoRefreshTimer = setInterval(() => {
      executeBatchFetch()
    }, seconds * 1000)
  }
}

export function useTelemetryCoordinator() {
  function register(widgetId: string, datapointId: string) {
    if (!datapointId) return

    if (!subscriptions.has(datapointId)) {
      subscriptions.set(datapointId, new Set())
    }
    subscriptions.get(datapointId)!.add(widgetId)

    // In Design Time: fetch once for preview if not in cache yet
    if (!seriesCache[datapointId] || seriesCache[datapointId].length === 0) {
      scheduleBatchFetch()
    }
  }

  function unregister(widgetId: string, datapointId?: string) {
    if (datapointId && subscriptions.has(datapointId)) {
      subscriptions.get(datapointId)!.delete(widgetId)
      if (subscriptions.get(datapointId)!.size === 0) {
        subscriptions.delete(datapointId)
      }
    } else {
      // Remove widget from all subscriptions
      for (const [dpId, subs] of subscriptions.entries()) {
        subs.delete(widgetId)
        if (subs.size === 0) {
          subscriptions.delete(dpId)
        }
      }
    }
  }

  function setTimeRange(range: string) {
    timeRange.value = range
    // Immediate batch refresh with new time window
    scheduleBatchFetch(0)
  }

  function refreshNow() {
    executeBatchFetch()
  }

  function getSeries(datapointId: Ref<string | undefined> | string | undefined) {
    return computed(() => {
      const id = typeof datapointId === 'object' && 'value' in datapointId ? datapointId.value : datapointId
      if (!id) return []
      return seriesCache[id] || []
    })
  }

  function getMetadata(datapointId: Ref<string | undefined> | string | undefined) {
    return computed(() => {
      const id = typeof datapointId === 'object' && 'value' in datapointId ? datapointId.value : datapointId
      if (!id) return {}
      return metadataCache[id] || {}
    })
  }

  return {
    timeRange,
    refreshIntervalSeconds,
    isLoading,
    lastFetched,
    seriesCache,
    metadataCache,
    register,
    unregister,
    refreshNow,
    setTimeRange,
    configureAutoRefresh,
    getSeries,
    getMetadata,
  }
}
