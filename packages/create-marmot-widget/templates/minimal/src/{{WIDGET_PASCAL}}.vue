<script setup lang="ts">
import { computed } from 'vue'

/**
 * Minimal widget starting point.
 * Rename this file (and the config) to something meaningful for your widget,
 * then update `src/index.ts` if you change the file names.
 */
const props = withDefaults(
  defineProps<{
    /** Title shown above the readout */
    label?: string
    /** Static fallback value used when no dataPoint is bound */
    value?: number
    /** Telemetry key whose live value feeds this widget */
    dataPoint?: string
    /** Custom background fill; empty string falls back to frosted glass */
    backgroundColor?: string
    /** Live telemetry map injected by the Marmot host: { [dataPointId]: value } */
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    label: 'New Widget',
    value: 0,
    dataPoint: '',
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
</script>

<template>
  <div
    class="widget-card {{WIDGET_ID}}-widget"
    :class="props.backgroundColor === '' ? 'widget-glass' : ''"
    :style="{ background: props.backgroundColor }"
  >
    <span v-if="label" class="widget-label">{{ label }}</span>
    <span class="widget-readout">{{ currentValue }}</span>
  </div>
</template>

<style scoped>
.{{WIDGET_ID}}-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  text-align: center;
}

.widget-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  opacity: 0.7;
}

.widget-readout {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
</style>
