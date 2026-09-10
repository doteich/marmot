<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    min?: number
    max?: number
    unit?: string
    value?: number
  }>(),
  {
    title: 'Pressure / Temp',
    min: 0,
    max: 100,
    unit: '°C',
    value: 65,
  }
)

const percentage = computed(() => {
  const range = props.max - props.min || 1
  const pct = Math.max(0, Math.min(100, ((props.value - props.min) / range) * 100))
  return pct
})

const strokeDashoffset = computed(() => {
  const circumference = 2 * Math.PI * 40
  // Arc is 270 degrees (0.75 of circle)
  const arcLength = circumference * 0.75
  const offset = arcLength - (percentage.value / 100) * arcLength
  return offset
})
</script>

<template>
  <div class="gauge-card">
    <div class="gauge-title">{{ title }}</div>
    <div class="gauge-content">
      <svg viewBox="0 0 100 100" class="gauge-svg">
        <!-- Background Arc -->
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#334155"
          stroke-width="8"
          stroke-dasharray="188.49"
          stroke-dashoffset="62.83"
          transform="rotate(135 50 50)"
          stroke-linecap="round"
        />
        <!-- Active Value Arc -->
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          :stroke="percentage > 80 ? '#ef4444' : percentage > 50 ? '#38bdf8' : '#22c55e'"
          stroke-width="8"
          stroke-dasharray="188.49"
          :stroke-dashoffset="62.83 + strokeDashoffset"
          transform="rotate(135 50 50)"
          stroke-linecap="round"
          class="gauge-progress"
        />
      </svg>
      <div class="gauge-readout">
        <span class="gauge-val">{{ value.toFixed(1) }}</span>
        <span class="gauge-unit">{{ unit }}</span>
      </div>
    </div>
    <div class="gauge-limits">
      <span>{{ min }}</span>
      <span>{{ max }}</span>
    </div>
  </div>
</template>

<style scoped>
.gauge-card {
  width: 100%;
  height: 100%;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  box-sizing: border-box;
  color: #f8fafc;
}

.gauge-title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gauge-content {
  position: relative;
  width: 70%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gauge-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.gauge-progress {
  transition: stroke-dashoffset 0.4s ease, stroke 0.3s ease;
}

.gauge-readout {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gauge-val {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.gauge-unit {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.gauge-limits {
  width: 80%;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
}
</style>
