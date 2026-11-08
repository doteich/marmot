<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Trend Counter
 *
 * Shows the latest live value plus a trend indicator derived from the last
 * `windowSize` distinct samples. The trend compares the newest sample against
 * the oldest sample still inside the window:
 *
 *   delta >  flatThreshold  → ▲ (up)
 *   delta < -flatThreshold  → ▼ (down)
 *   otherwise               → ◆ (flat)
 *
 * This demonstrates a common extension pattern: keeping a small amount of
 * internal history so the widget can reason about change over time, which the
 * host's single-value telemetry map does not provide on its own.
 */
const props = withDefaults(
  defineProps<{
    /** Small caption shown above the value */
    label?: string
    /** Unit suffix rendered after the value (e.g. "pcs/min", "°C") */
    unit?: string
    /** Number of decimal places for the readout */
    precision?: number
    /** Static fallback value used when no dataPoint is bound */
    value?: number
    /** Telemetry key whose live value feeds this widget */
    dataPoint?: string
    /** Number of recent distinct samples used to compute the trend */
    windowSize?: number
    /** Deltas smaller than this are treated as "flat" */
    flatThreshold?: number
    /** Show the numeric delta next to the trend arrow */
    showDelta?: boolean
    /** Trend color when the value is rising */
    upColor?: string
    /** Trend color when the value is falling */
    downColor?: string
    /** Trend color when the value is stable */
    flatColor?: string
    /** Custom background fill; empty string falls back to frosted glass */
    backgroundColor?: string
    /** Live telemetry map injected by the Marmot host: { [dataPointId]: value } */
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    label: 'Counter',
    unit: '',
    precision: 1,
    value: 0,
    dataPoint: '',
    windowSize: 5,
    flatThreshold: 0.001,
    showDelta: true,
    upColor: '#10b981',
    downColor: '#ef4444',
    flatColor: '#f59e0b',
    backgroundColor: '',
    telemetryValues: () => ({}),
  },
)

/** Resolve the newest numeric sample from live telemetry, else the static prop. */
const currentValue = computed<number>(() => {
  const raw = props.dataPoint ? props.telemetryValues?.[props.dataPoint] : undefined
  if (raw !== undefined && raw !== null) {
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (Number.isFinite(parsed)) return parsed
  }
  const fallback = typeof props.value === 'number' ? props.value : parseFloat(String(props.value))
  return Number.isFinite(fallback) ? fallback : 0
})

const effectiveWindow = computed(() => {
  const n = Number(props.windowSize)
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 5
})

const decimalPlaces = computed(() => {
  const n = Number(props.precision)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
})

/** Sliding window of the most recent distinct samples (newest last). */
const history = ref<number[]>([])

/** Seed the window with copies of `value` so the widget starts "flat". */
function seedWindow(value: number) {
  history.value = Array.from({ length: effectiveWindow.value }, () => value)
}

watch(
  currentValue,
  (next) => {
    if (history.value.length === 0) {
      seedWindow(next)
      return
    }
    if (history.value[history.value.length - 1] === next) return
    history.value = [...history.value, next].slice(-effectiveWindow.value)
  },
  { immediate: true },
)

// Re-baseline the trend when the bound data point changes, so samples from the
// previous data point never leak into the new window. Declared after the
// currentValue watcher so it wins during the same flush.
watch(
  () => props.dataPoint,
  () => {
    history.value = []
    seedWindow(currentValue.value)
  },
)

const delta = computed<number>(() => {
  const h = history.value
  if (h.length < 2) return 0
  const newest = h[h.length - 1] ?? 0
  const oldest = h[0] ?? 0
  return newest - oldest
})

type Trend = 'up' | 'down' | 'flat'

const trend = computed<Trend>(() => {
  const threshold = Number(props.flatThreshold) || 0
  if (Math.abs(delta.value) < threshold) return 'flat'
  return delta.value > 0 ? 'up' : 'down'
})

const arrow = computed(() => (trend.value === 'up' ? '▲' : trend.value === 'down' ? '▼' : '◆'))

const trendColor = computed(() => {
  if (trend.value === 'up') return props.upColor
  if (trend.value === 'down') return props.downColor
  return props.flatColor
})

const formattedValue = computed(() => currentValue.value.toFixed(decimalPlaces.value))

const formattedDelta = computed(() => {
  const magnitude = Math.abs(delta.value).toFixed(decimalPlaces.value)
  if (delta.value > 0) return `+${magnitude}`
  if (delta.value < 0) return `-${magnitude}`
  return magnitude
})
</script>

<template>
  <div
    class="widget-card counter-widget"
    :class="props.backgroundColor === '' ? 'widget-glass' : ''"
    :style="{ background: props.backgroundColor }"
  >
    <span v-if="label" class="counter-label">{{ label }}</span>

    <div class="counter-body">
      <span class="counter-value">{{ formattedValue }}</span>
      <span v-if="unit" class="counter-unit">{{ unit }}</span>
    </div>

    <div class="counter-trend" :style="{ color: trendColor }">
      <span class="trend-arrow" :title="trend">{{ arrow }}</span>
      <span v-if="showDelta" class="trend-delta">{{ formattedDelta }}</span>
    </div>
  </div>
</template>

<style scoped>
.counter-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  text-align: center;
}

.counter-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  opacity: 0.7;
}

.counter-body {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.counter-value {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.counter-unit {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.65;
}

.counter-trend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.trend-arrow {
  font-size: 14px;
  line-height: 1;
}

.trend-delta {
  opacity: 0.9;
}
</style>
