import { computed, watch, onMounted, onUnmounted, type Ref, isRef } from 'vue'
import { useTelemetryCoordinator } from './useTelemetryCoordinator'

export interface HistoryPoint {
  time: string
  value: number
  min?: number
  max?: number
  count: number
}

export interface HistorySeries {
  dataPointId: string
  dataPointName?: string
  machineId?: string
  unit?: string
  points: HistoryPoint[]
}

export interface HistoryResponse {
  from: string
  to: string
  bucket: string
  agg: string
  series: HistorySeries[]
}

export interface HistoryQueryOptions {
  from?: string // e.g. '15m', '1h', '6h', '24h', '7d', or ISO string
  to?: string // e.g. 'now' or ISO string
  bucket?: string // 'auto', 'raw', '10s', '1m', '5m', '15m', '1h'
  agg?: string // 'avg', 'min', 'max', 'sum', 'count'
}

/**
 * Low-level utility to directly fetch historical data for a specific datapoint
 */
export async function fetchTelemetryHistory(
  datapointId: string,
  options: HistoryQueryOptions = {}
): Promise<HistorySeries | null> {
  if (!datapointId) return null

  const params = new URLSearchParams()
  params.set('datapointId', datapointId)
  if (options.from) params.set('from', options.from)
  if (options.to) params.set('to', options.to)
  if (options.bucket) params.set('bucket', options.bucket)
  if (options.agg) params.set('agg', options.agg)

  try {
    const res = await fetch(`/api/telemetry/history?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`)
    }
    const data: HistoryResponse = await res.json()
    return data.series?.[0] || null
  } catch (err) {
    console.warn(`[History] Direct fetch failed for ${datapointId}:`, err)
    throw err
  }
}

/**
 * Unified, batched reactive composable for widgets.
 * Hooks into Central Telemetry Coordinator: zero duplicate requests, batched HTTP, synchronized updates.
 */
export function useHistoricalTelemetry(
  datapointId: Ref<string | undefined> | string | undefined
) {
  const coordinator = useTelemetryCoordinator()
  const widgetId = `widget-${Math.random().toString(36).substring(2, 9)}`

  const getDpId = (): string => {
    if (isRef(datapointId)) {
      return datapointId.value || ''
    }
    return datapointId || ''
  }

  const points = coordinator.getSeries(datapointId)
  const metadata = coordinator.getMetadata(datapointId)
  const isLoading = coordinator.isLoading
  const error = computed<string | null>(() => null)

  function updateRegistration(oldId?: string) {
    if (oldId) {
      coordinator.unregister(widgetId, oldId)
    }
    const currentId = getDpId()
    if (currentId) {
      coordinator.register(widgetId, currentId)
    }
  }

  if (isRef(datapointId)) {
    watch(datapointId, (newVal, oldVal) => {
      updateRegistration(oldVal)
    })
  }

  onMounted(() => {
    updateRegistration()
  })

  onUnmounted(() => {
    coordinator.unregister(widgetId)
  })

  return {
    points,
    metadata,
    isLoading,
    error,
    refresh: coordinator.refreshNow,
  }
}
