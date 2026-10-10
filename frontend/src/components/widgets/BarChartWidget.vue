<script lang="ts">
export { default as BarChartConfig } from './BarChartConfig.vue'
</script>

<script setup lang="ts">
import { ref, computed, toRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart, type ChartConfiguration } from 'chart.js'
import { getChartThemeColors } from '@/plugins/chart'
import { useHistoricalTelemetry, type HistoryPoint } from '@/composables/useHistoricalTelemetry'

const props = withDefaults(
  defineProps<{
    title?: string
    dataPoint?: string
    unit?: string
    barColor?: string
    interval?: string // '5m', '10m', '15m', '30m', '1h', '4h', '8h', '24h'
    calcMode?: 'delta' | 'sum' | 'avg' | 'max'
    targetValue?: number
    showTargetLine?: boolean
    backgroundColor?: string
    borderColor?: string
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    title: 'Output / Throughput',
    dataPoint: '',
    unit: 'pcs',
    barColor: '#10b981',
    interval: '1h',
    calcMode: 'delta',
    targetValue: undefined,
    showTargetLine: false,
    backgroundColor: '',
    borderColor: '',
    telemetryValues: () => ({}),
  }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let chartInstance: Chart | null = null
let resizeObserver: ResizeObserver | null = null

const dataPointRef = toRef(props, 'dataPoint')
const { points: historicalPoints, metadata, isLoading } = useHistoricalTelemetry(dataPointRef)

const activeUnit = computed(() => props.unit || metadata.value.unit || '')

/**
 * Convert interval string to milliseconds
 */
function parseIntervalMs(intervalStr: string): number {
  const match = intervalStr.match(/^(\d+)([mhd])$/)
  if (!match) return 3600 * 1000 // default 1h
  const val = parseInt(match[1] || '1', 10)
  const unit = match[2]
  if (unit === 'm') return val * 60 * 1000
  if (unit === 'h') return val * 3600 * 1000
  if (unit === 'd') return val * 86400 * 1000
  return 3600 * 1000
}

interface BucketData {
  label: string
  timestamp: number
  value: number
  count: number
}

/**
 * Calculate bucket deltas (last - first) or aggregates based on selected interval
 */
const bucketedData = computed<BucketData[]>(() => {
  const raw = historicalPoints.value
  if (!raw || raw.length === 0) return []

  const intervalMs = parseIntervalMs(props.interval || '1h')
  const mode = props.calcMode || 'delta'

  // Sort raw points chronologically
  const sorted = [...raw].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  )

  // Map points into bucket bins
  const bucketsMap = new Map<number, HistoryPoint[]>()
  for (const pt of sorted) {
    const t = new Date(pt.time).getTime()
    const bucketStart = Math.floor(t / intervalMs) * intervalMs
    if (!bucketsMap.has(bucketStart)) {
      bucketsMap.set(bucketStart, [])
    }
    bucketsMap.get(bucketStart)!.push(pt)
  }

  const result: BucketData[] = []
  const sortedBucketKeys = Array.from(bucketsMap.keys()).sort((a, b) => a - b)

  for (const bStart of sortedBucketKeys) {
    const pts = bucketsMap.get(bStart)!
    let val = 0

    if (mode === 'delta') {
      if (pts.length >= 2) {
        val = pts[pts.length - 1]!.value - pts[0]!.value
      } else if (pts.length === 1) {
        val = pts[0]!.value
      }
      // Industrial counters wrap/reset check: clamp negative jumps to zero
      if (val < 0) val = Math.max(0, pts[pts.length - 1]!.value)
    } else if (mode === 'sum') {
      val = pts.reduce((acc, p) => acc + p.value, 0)
    } else if (mode === 'max') {
      val = Math.max(...pts.map((p) => p.value))
    } else {
      // Average
      val = pts.reduce((acc, p) => acc + p.value, 0) / pts.length
    }

    const d = new Date(bStart)
    const label =
      intervalMs >= 86400 * 1000
        ? d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    result.push({
      label,
      timestamp: bStart,
      value: Math.round(val * 100) / 100,
      count: pts.length,
    })
  }

  return result
})

const latestValue = computed(() => {
  if (bucketedData.value.length === 0) return null
  return bucketedData.value[bucketedData.value.length - 1]?.value ?? null
})

const totalValue = computed(() => {
  if (bucketedData.value.length === 0) return 0
  return bucketedData.value.reduce((acc, b) => acc + b.value, 0)
})

function buildChartConfig(): ChartConfiguration {
  const theme = getChartThemeColors(containerRef.value)
  const data = bucketedData.value
  const labels = data.map((b) => b.label)
  const values = data.map((b) => b.value)

  const datasets: ChartConfiguration['data']['datasets'] = [
    {
      type: 'bar',
      label: props.title || 'Throughput',
      data: values,
      backgroundColor: props.barColor || '#10b981',
      hoverBackgroundColor: '#38bdf8',
      borderRadius: 4,
      borderSkipped: false,
    },
  ]

  // Optional target line dataset
  if (props.showTargetLine && props.targetValue !== undefined && labels.length > 0) {
    datasets.push({
      type: 'line',
      label: `Target (${props.targetValue})`,
      data: labels.map(() => props.targetValue as number),
      borderColor: '#f59e0b',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
    })
  }

  return {
    type: 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 350,
      },
      plugins: {
        legend: {
          display: props.showTargetLine,
          labels: {
            color: theme.textColor,
            boxWidth: 12,
            font: { size: 10, family: 'inherit' },
          },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 8,
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.parsed.y} ${activeUnit.value}`
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: theme.textColor,
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
          },
          border: {
            color: theme.borderColor,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: theme.gridColor,
          },
          ticks: {
            color: theme.textColor,
            font: { size: 10 },
          },
          border: {
            color: theme.borderColor,
          },
        },
      },
    },
  }
}

function renderChart() {
  if (!canvasRef.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const config = buildChartConfig()
  chartInstance = new Chart(canvasRef.value, config)
}

function updateChartData() {
  if (!chartInstance) {
    renderChart()
    return
  }

  const theme = getChartThemeColors(containerRef.value)
  const data = bucketedData.value
  const labels = data.map((b) => b.label)
  const values = data.map((b) => b.value)

  chartInstance.data.labels = labels
  if (chartInstance.data.datasets[0]) {
    chartInstance.data.datasets[0].data = values
    chartInstance.data.datasets[0].backgroundColor = props.barColor || '#10b981'
    chartInstance.data.datasets[0].label = props.title || 'Throughput'
  }

  // Update or toggle target line
  if (props.showTargetLine && props.targetValue !== undefined && labels.length > 0) {
    const targetData = labels.map(() => props.targetValue as number)
    if (chartInstance.data.datasets[1]) {
      chartInstance.data.datasets[1].data = targetData
      chartInstance.data.datasets[1].label = `Target (${props.targetValue})`
    } else {
      chartInstance.data.datasets.push({
        type: 'line',
        label: `Target (${props.targetValue})`,
        data: targetData,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      })
    }
  } else if (chartInstance.data.datasets.length > 1) {
    chartInstance.data.datasets.splice(1, 1)
  }

  // Update theme colors in scales
  if (chartInstance.options.scales?.y?.grid) {
    chartInstance.options.scales.y.grid.color = theme.gridColor
  }

  chartInstance.update('none')
}

watch(
  [
    () => bucketedData.value,
    () => props.barColor,
    () => props.targetValue,
    () => props.showTargetLine,
    () => props.title,
  ],
  () => {
    updateChartData()
  },
  { deep: true }
)

onMounted(() => {
  renderChart()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (chartInstance) {
        chartInstance.resize()
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="bar-chart-card widget-card"
    :class="{
      'widget-solid': backgroundColor === 'solid',
      'widget-glass': !backgroundColor || backgroundColor === 'glass' || backgroundColor === 'transparent',
    }"
    :style="{
      background: (backgroundColor && !['glass', 'solid', 'transparent'].includes(backgroundColor))
        ? backgroundColor
        : undefined,
      borderColor: borderColor || undefined,
    }"
  >
    <!-- Header -->
    <div class="chart-header">
      <div class="header-meta">
        <span class="chart-title">{{ title }}</span>
        <span class="chart-tag">
          {{ metadata.name || '' }} ({{ interval }} {{ calcMode }})
        </span>
      </div>

      <div class="header-readout">
        <div class="readout-block">
          <span class="readout-label">Latest</span>
          <span v-if="latestValue !== null" class="readout-val">
            {{ latestValue.toFixed(0) }} <span class="readout-unit">{{ activeUnit }}</span>
          </span>
          <span v-else class="readout-empty">--</span>
        </div>

        <div class="readout-block">
          <span class="readout-label">Total</span>
          <span class="readout-val">
            {{ totalValue.toFixed(0) }} <span class="readout-unit">{{ activeUnit }}</span>
          </span>
        </div>

        <span v-if="isLoading" class="sync-indicator">Syncing...</span>
      </div>
    </div>

    <!-- Canvas Chart Container -->
    <div class="chart-canvas-wrapper">
      <canvas ref="canvasRef"></canvas>

      <div v-if="bucketedData.length === 0" class="empty-overlay">
        <span v-if="!dataPoint">Select a Data Point in Properties</span>
        <span v-else>No throughput / bucket data recorded for {{ interval }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-chart-card {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  box-sizing: border-box;
  color: var(--canvas-theme-text, #f4f4f5);
  overflow: hidden;
  user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.header-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.chart-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--canvas-theme-text, #f4f4f5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-tag {
  font-size: 11px;
  color: var(--canvas-theme-text-muted, #a1a1aa);
  white-space: nowrap;
}

.header-readout {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-shrink: 0;
}

.readout-block {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.readout-label {
  font-size: 10px;
  color: var(--canvas-theme-text-muted, #a1a1aa);
  text-transform: uppercase;
}

.readout-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--canvas-theme-text, #f4f4f5);
}

.readout-unit {
  font-size: 11px;
  font-weight: 500;
  color: var(--canvas-theme-text-muted, #a1a1aa);
}

.readout-empty {
  font-size: 13px;
  color: var(--canvas-theme-text-muted, #a1a1aa);
}

.sync-indicator {
  font-size: 10px;
  color: var(--app-accent);
  animation: pulse 1.5s infinite;
}

.chart-canvas-wrapper {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
}

.empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--app-text-muted);
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
