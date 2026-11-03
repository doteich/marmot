<script setup lang="ts">
import { computed } from 'vue'

export type TankShape = 'tank_barrel' | 'tank_pin' | 'tank_rounded'

const props = withDefaults(
  defineProps<{
    shape?: TankShape
    fillColor?: string
    capacity?: number
    dataPoint?: string
    value?: number
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    shape: 'tank_barrel',
    fillColor: '#0284c7',
    capacity: 1000,
    dataPoint: '',
    value: 650,
    telemetryValues: () => ({}),
  }
)

interface LegPath {
  d: string
  transform?: string
}

interface TankTemplate {
  viewBox: string
  topY: number
  bottomY: number
  legs: LegPath[]
  body: {
    d: string
    transform?: string
  }
  rim?: string
}

// 1. Tank SVG template definitions (solid grey by default)
const tankTemplates: Record<TankShape, TankTemplate> = {
  tank_barrel: {
    viewBox: '0 0 82 161',
    topY: 0,
    bottomY: 150,
    legs: [
      { d: 'M 0 160 L 30 128 L 50 128 L 20 160 Z' },
      { d: 'M 30 160 L 60 128 L 80 128 L 50 160 Z', transform: 'translate(0,144)scale(1,-1)translate(0,-144)' },
    ],
    body: {
      d: 'M 0 15 C 0 6.72 17.91 0 40 0 C 50.61 0 60.78 1.58 68.28 4.39 C 75.79 7.21 80 11.02 80 15 L 80 135 C 80 143.28 62.09 150 40 150 C 17.91 150 0 143.28 0 135 Z',
    },
    rim: 'M 80 15 C 80 23.28 62.09 30 40 30 C 17.91 30 0 23.28 0 15',
  },
  tank_pin: {
    viewBox: '0 0 82 123',
    topY: 0,
    bottomY: 120,
    legs: [
      { d: 'M 30 122 L 60 90 L 80 90 L 50 122 Z', transform: 'translate(0,106)scale(1,-1)translate(0,-106)' },
      { d: 'M 0 122 L 30 90 L 50 90 L 20 122 Z' },
    ],
    body: {
      d: 'M 0 0 L 80 0 L 80 75 L 40 120 L 0 75 Z',
    },
    rim: undefined,
  },
  tank_rounded: {
    viewBox: '0 0 82 121',
    topY: 0,
    bottomY: 110,
    legs: [
      { d: 'M 0 120 L 30 88 L 50 88 L 20 120 Z' },
      { d: 'M 30 120 L 60 88 L 80 88 L 50 120 Z', transform: 'translate(0,104)scale(1,-1)translate(0,-104)' },
    ],
    body: {
      d: 'M 0 0 L 80 0 L 80 70 Q 80 110 40 110 Q 0 110 0 70 Z',
    },
    rim: undefined,
  },
}

// Stable unique clip ID per instance to isolate SVG clipping
const clipId = 'tank-clip-' + Math.random().toString(36).substring(2, 9)

const currentTemplate = computed(() => {
  const key = props.shape || 'tank_barrel'
  return tankTemplates[key] || tankTemplates.tank_barrel
})

// Safe capacity resolution
const capacityNum = computed(() => {
  const c = Number(props.capacity)
  return !isNaN(c) && c > 0 ? c : 1000
})

// 2. Resolve live integer value from telemetry or static prop
const currentValue = computed(() => {
  if (props.dataPoint && props.telemetryValues && props.telemetryValues[props.dataPoint] !== undefined) {
    const raw = props.telemetryValues[props.dataPoint]
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw))
    return !isNaN(parsed) ? Math.round(parsed) : 0
  }
  const fallback = typeof props.value === 'number' ? props.value : parseFloat(String(props.value))
  return !isNaN(fallback) ? Math.round(fallback) : 0
})

// 3. Calculate amount filled in percent (current value / capacity) strictly clamped 0..100
const fillPercent = computed(() => {
  const pct = (currentValue.value / capacityNum.value) * 100
  if (isNaN(pct) || !isFinite(pct)) return 0
  return Math.min(100, Math.max(0, Math.round(pct)))
})

// Calculate SVG clip rect geometry
const clipY = computed(() => {
  if (fillPercent.value <= 0) return currentTemplate.value.bottomY + 10
  const h = currentTemplate.value.bottomY - currentTemplate.value.topY
  return currentTemplate.value.bottomY - (fillPercent.value / 100) * h
})

const clipHeight = computed(() => {
  if (fillPercent.value <= 0) return 0
  const h = currentTemplate.value.bottomY - currentTemplate.value.topY
  return (fillPercent.value / 100) * h + 2
})
</script>

<template>
  <div class="widget-card widget-glass tank-widget">
    <!-- Single Unified SVG Graphic -->
    <div class="tank-graphic-wrapper">
      <svg
        class="tank-svg"
        :viewBox="currentTemplate.viewBox"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath :id="clipId">
            <rect
              x="-5"
              :y="clipY"
              width="92"
              :height="clipHeight"
            />
          </clipPath>
        </defs>

        <!-- Layer 1: Tank Support Legs -->
        <g class="tank-legs">
          <path
            v-for="(leg, i) in currentTemplate.legs"
            :key="'leg-' + i"
            :d="leg.d"
            :transform="leg.transform"
            fill="#475569"
          />
        </g>

        <!-- Layer 2: Solid Grey Base Tank Body -->
        <path
          :d="currentTemplate.body.d"
          :transform="currentTemplate.body.transform"
          fill="#334155"
          opacity="0.5"
        />

        <!-- Layer 3: Liquid Fill Overlay (Gradual fill with selected color, clipped to percentage) -->
        <g :clip-path="`url(#${clipId})`">
          <path
            :d="currentTemplate.body.d"
            :transform="currentTemplate.body.transform"
            :fill="fillColor"
            opacity="0.9"
          />
        </g>

        <!-- Layer 4: Tank Outline Stroke -->
        <path
          :d="currentTemplate.body.d"
          :transform="currentTemplate.body.transform"
          fill="none"
          stroke="#64748b"
          stroke-width="1.5"
        />

        <!-- Layer 5: Rim Outline (for barrel shape) -->
        <path
          v-if="currentTemplate.rim"
          :d="currentTemplate.rim"
          fill="none"
          stroke="#64748b"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <!-- Readout & Progress Bar -->
    <div class="tank-footer">
      <div class="tank-readout">
        <span class="value-text">{{ currentValue }} / {{ capacityNum }}</span>
        <span class="percent-text">{{ fillPercent }}%</span>
      </div>
      <div class="tank-bar-track">
        <div
          class="tank-bar-fill"
          :style="{ width: `${fillPercent}%`, backgroundColor: fillColor }"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tank-widget {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
}

.tank-graphic-wrapper {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.tank-svg {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.tank-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  flex-shrink: 0;
}

.tank-readout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.value-text {
  opacity: 0.85;
}

.percent-text {
  color: var(--app-accent, #38bdf8);
  font-weight: 700;
}

.tank-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.tank-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.35s ease;
}
</style>
