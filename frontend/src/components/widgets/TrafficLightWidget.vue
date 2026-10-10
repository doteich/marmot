<script lang="ts">
export { default as TrafficLightConfig } from './TrafficLightConfig.vue'
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    dataPoint?: string
    orientation?: 'vertical' | 'horizontal'
    showLabels?: boolean
    ruleMode?: 'discrete' | 'threshold'
    runValues?: string
    warnValues?: string
    alarmValues?: string
    defaultState?: 'off' | 'green' | 'yellow' | 'red'
    thresholdType?: 'high-alarm' | 'low-alarm'
    redThreshold?: number
    yellowThreshold?: number
    activeState?: 'red' | 'yellow' | 'green' | 'off'
    backgroundColor?: string
    borderColor?: string
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    title: 'Machine Status',
    dataPoint: '',
    orientation: 'vertical',
    showLabels: true,
    ruleMode: 'discrete',
    runValues: '1, run, running, auto, ok, good',
    warnValues: '2, warn, warning, idle, manual',
    alarmValues: '0, 3, fault, stopped, alarm, error',
    defaultState: 'off',
    thresholdType: 'high-alarm',
    redThreshold: 80,
    yellowThreshold: 50,
    activeState: 'green',
    backgroundColor: '',
    borderColor: '',
    telemetryValues: () => ({}),
  }
)

/**
 * Check if the raw value matches any token in a comma-separated list
 */
function matchesList(valStr: string, listStr: string): boolean {
  if (!listStr) return false
  const tokens = listStr
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
  return tokens.includes(valStr)
}

const resolvedState = computed<'red' | 'yellow' | 'green' | 'off'>(() => {
  // If no dataPoint is bound, fallback to configured activeState
  if (!props.dataPoint || !props.telemetryValues || !(props.dataPoint in props.telemetryValues)) {
    return props.activeState || 'green'
  }

  const raw = props.telemetryValues[props.dataPoint]
  if (raw === undefined || raw === null) {
    return props.defaultState || 'off'
  }

  // Threshold / Range Rule Mode
  if (props.ruleMode === 'threshold') {
    const num = Number(raw)
    if (isNaN(num)) return props.defaultState || 'off'

    if (props.thresholdType === 'low-alarm') {
      if (num <= (props.redThreshold ?? 20)) return 'red'
      if (num <= (props.yellowThreshold ?? 50)) return 'yellow'
      return 'green'
    } else {
      // High-alarm (standard)
      if (num >= (props.redThreshold ?? 80)) return 'red'
      if (num >= (props.yellowThreshold ?? 50)) return 'yellow'
      return 'green'
    }
  }

  // Discrete Value Matching Mode
  const s = String(raw).toLowerCase().trim()

  if (matchesList(s, props.alarmValues)) {
    return 'red'
  }
  if (matchesList(s, props.warnValues)) {
    return 'yellow'
  }
  if (matchesList(s, props.runValues)) {
    return 'green'
  }

  return props.defaultState || 'off'
})

const lights = [
  { id: 'red', name: 'ALARM', onColor: '#ef4444', offColor: '#3b1216', glow: 'rgba(239, 68, 68, 0.75)' },
  { id: 'yellow', name: 'WARN', onColor: '#f59e0b', offColor: '#3b250b', glow: 'rgba(245, 158, 11, 0.75)' },
  { id: 'green', name: 'RUN', onColor: '#10b981', offColor: '#0b3826', glow: 'rgba(16, 185, 129, 0.75)' },
]
</script>

<template>
  <div
    class="traffic-light-card widget-card"
    :class="[
      orientation,
      {
        'widget-solid': backgroundColor === 'solid',
        'widget-glass': !backgroundColor || backgroundColor === 'glass' || backgroundColor === 'transparent',
      },
    ]"
    :style="{
      background: (backgroundColor && !['glass', 'solid', 'transparent'].includes(backgroundColor))
        ? backgroundColor
        : undefined,
      borderColor: borderColor || undefined,
    }"
  >
    <div v-if="title" class="light-title">{{ title }}</div>

    <div class="signal-housing" :class="[orientation]">
      <div
        v-for="light in lights"
        :key="light.id"
        class="bulb-slot"
      >
        <div
          class="bulb"
          :class="{
            active: resolvedState === light.id,
            [light.id]: true,
          }"
          :style="{
            backgroundColor: resolvedState === light.id ? light.onColor : light.offColor,
            boxShadow:
              resolvedState === light.id
                ? `0 0 16px ${light.glow}, inset 0 0 8px rgba(255, 255, 255, 0.6)`
                : 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
          }"
        >
          <!-- Lens texture ring -->
          <div class="bulb-reflection"></div>
        </div>

        <span
          v-if="showLabels"
          class="bulb-label"
          :class="{ 'is-active': resolvedState === light.id }"
        >
          {{ light.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.traffic-light-card {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  box-sizing: border-box;
  color: var(--canvas-theme-text, #f4f4f5);
  user-select: none;
  overflow: hidden;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.traffic-light-card.horizontal {
  flex-direction: column;
}

.light-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--canvas-theme-text-muted, #a1a1aa);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.signal-housing {
  background: #090d16;
  border: 2px solid var(--app-border);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  box-sizing: border-box;
}

.signal-housing.vertical {
  flex-direction: column;
  width: auto;
  min-width: 48px;
}

.signal-housing.horizontal {
  flex-direction: row;
  height: auto;
  min-height: 48px;
}

.bulb-slot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bulb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  position: relative;
  border: 2px solid #334155;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bulb.active {
  border-color: #f8fafc;
}

.bulb-reflection {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 70%);
  position: absolute;
  top: 3px;
  left: 6px;
  pointer-events: none;
}

.bulb-label {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.5px;
  min-width: 44px;
}

.bulb-label.is-active {
  color: var(--app-text);
}
</style>
