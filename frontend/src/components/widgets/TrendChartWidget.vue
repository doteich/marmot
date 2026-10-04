<script lang="ts">
export { default as TrendChartConfig } from './TrendChartConfig.vue'
</script>

<script setup lang="ts">
import { ref, computed, toRef, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart, type ChartConfiguration, type ScriptableContext, type ChartDataset } from 'chart.js'
import { getChartThemeColors } from '@/plugins/chart'
import { useHistoricalTelemetry, type HistoryPoint } from '@/composables/useHistoricalTelemetry'

const props = withDefaults(
  defineProps<{
    title?: string
    dataPoint?: string
    unit?: string
    showArea?: boolean
    lineColor?: string
    showGrid?: boolean
    min?: number
    max?: number
    backgroundColor?: string
    borderColor?: string
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    title: 'Trend Chart',
    dataPoint: '',
    unit: '',
    showArea: true,
    lineColor: '#0284c7',
    showGrid: true,
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
 * Combine historical series points with real-time websocket tail if available
 */
const chartPoints = computed<HistoryPoint[]>(() => {
  const pts = [...(historicalPoints.value || [])]

  if (props.dataPoint && props.telemetryValues && props.dataPoint in props.telemetryValues) {
    const raw = props.telemetryValues[props.dataPoint]
    const num = Number(raw)
    if (!isNaN(num)) {
      pts.push({
        time: new Date().toISOString(),
        value: num,
        count: 1,
      })
    }
  }

  return pts
})

const currentValue = computed<number | null>(() => {
  if (props.dataPoint && props.telemetryValues && props.dataPoint in props.telemetryValues) {
    const raw = props.telemetryValues[props.dataPoint]
    const num = Number(raw)
    if (!isNaN(num)) return num
  }
  if (chartPoints.value.length > 0) {
    return chartPoints.value[chartPoints.value.length - 1]?.value ?? null
  }
  return null
})


function buildChartConfig(): ChartConfiguration {
  const theme = getChartThemeColors()
  const pts = chartPoints.value

  const data = pts.map((p) => ({
    x: new Date(p.time).getTime(),
    y: p.value,
  }))

  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: props.title || 'Trend',
          data,
          borderColor: props.lineColor || '#0284c7',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: props.lineColor || '#0284c7',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          fill: props.showArea !== false ? 'origin' : false,
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const chart = context.chart
            const { ctx, chartArea } = chart
            if (!chartArea) return 'rgba(2, 132, 199, 0.1)'
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            gradient.addColorStop(0, hexToRgba(props.lineColor || '#0284c7', 0.35))
            gradient.addColorStop(1, hexToRgba(props.lineColor || '#0284c7', 0.0))
            return gradient
          },
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300,
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 8,
          callbacks: {
            title(items) {
              const xVal = items[0]?.parsed?.x
              if (xVal == null) return ''
              const d = new Date(xVal)
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            },
            label(ctx) {
              const val = ctx.parsed?.y != null ? ctx.parsed.y.toFixed(2) : '--'
              return `${ctx.dataset.label}: ${val} ${activeUnit.value}`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          grid: {
            display: false,
          },
          ticks: {
            color: theme.textColor,
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          border: {
            color: theme.borderColor,
          },
        },
        y: {
          min: props.min,
          max: props.max,
          grid: {
            display: props.showGrid !== false,
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

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgb')) return hex
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('')
  }
  const num = parseInt(c, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

  const theme = getChartThemeColors()
  const pts = chartPoints.value

  const data = pts.map((p) => ({
    x: new Date(p.time).getTime(),
    y: p.value,
  }))

  const ds = chartInstance.data.datasets[0] as ChartDataset<'line'> | undefined
  if (ds) {
    ds.data = data
    ds.borderColor = props.lineColor || '#0284c7'
    ds.label = props.title || 'Trend'
    ds.fill = props.showArea !== false ? 'origin' : false
  }

  // Update Y scale min/max
  if (chartInstance.options.scales?.y) {
    chartInstance.options.scales.y.min = props.min
    chartInstance.options.scales.y.max = props.max
    if (chartInstance.options.scales.y.grid) {
      chartInstance.options.scales.y.grid.display = props.showGrid !== false
      chartInstance.options.scales.y.grid.color = theme.gridColor
    }
  }

  chartInstance.update('none')
}

watch(
  [
    () => chartPoints.value,
    () => props.lineColor,
    () => props.showArea,
    () => props.showGrid,
    () => props.min,
    () => props.max,
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
    class="trend-chart-card"
    :style="{
      backgroundColor: backgroundColor || 'var(--app-surface)',
      borderColor: borderColor || 'var(--app-border)',
    }"
  >
    <!-- Header -->
    <div class="chart-header">
      <div class="header-meta">
        <span class="chart-title">{{ title }}</span>
        <span v-if="metadata.name" class="chart-tag">{{ metadata.name }}</span>
      </div>

      <div class="header-readout">
        <span v-if="currentValue !== null" class="readout-val">
          {{ currentValue.toFixed(1) }}
          <span class="readout-unit">{{ activeUnit }}</span>
        </span>
        <span v-else class="readout-empty">--</span>

        <span v-if="isLoading" class="sync-indicator">Syncing...</span>
      </div>
    </div>

    <!-- Canvas Chart Container -->
    <div class="chart-canvas-wrapper">
      <canvas ref="canvasRef"></canvas>

      <!-- Empty state when no data -->
      <div v-if="chartPoints.length === 0" class="empty-overlay">
        <span v-if="!dataPoint">Select a Data Point in Properties</span>
        <span v-else>No historical telemetry available</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-chart-card {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  box-sizing: border-box;
  color: var(--app-text);
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
  color: var(--app-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-tag {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.header-readout {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
}

.readout-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
}

.readout-unit {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-muted);
  margin-left: 2px;
}

.readout-empty {
  font-size: 14px;
  color: var(--app-text-muted);
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
