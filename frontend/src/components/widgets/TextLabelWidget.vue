<script lang="ts">
export { default as TextLabelConfig } from './TextLabelConfig.vue'
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text?: string
    fontSize?: number
    fontWeight?: string
    textColor?: string
    backgroundColor?: string
    borderColor?: string
    borderRadius?: number
    textAlign?: 'left' | 'center' | 'right'
    padding?: number
    dataPoint?: string
    unit?: string
    telemetryValues?: Record<string, unknown>
  }>(),
  {
    text: 'Zone Label',
    fontSize: 14,
    fontWeight: '600',
    textColor: '',
    backgroundColor: 'glass',
    borderColor: '',
    borderRadius: 6,
    textAlign: 'center',
    padding: 8,
    dataPoint: '',
    unit: '',
    telemetryValues: () => ({}),
  }
)

const displayedContent = computed(() => {
  const hasTelemetry =
    props.dataPoint &&
    props.telemetryValues &&
    props.dataPoint in props.telemetryValues

  const liveVal = hasTelemetry ? props.telemetryValues[props.dataPoint] : undefined

  if (liveVal !== undefined) {
    const formatted = typeof liveVal === 'number' ? liveVal.toFixed(1) : String(liveVal)
    // If user provided a template like "{value} °C" or "Speed: {value}"
    if (props.text && props.text.includes('{value}')) {
      return props.text.replace(/\{value\}/g, formatted)
    }
    if (props.text) {
      return `${props.text}: ${formatted}${props.unit ? ' ' + props.unit : ''}`
    }
    return `${formatted}${props.unit ? ' ' + props.unit : ''}`
  }

  return props.text || 'Label'
})
</script>

<template>
  <div
    class="text-label-widget widget-card"
    :class="{
      'widget-solid': backgroundColor === 'solid',
      'widget-glass': !backgroundColor || backgroundColor === 'glass' || backgroundColor === 'transparent',
    }"
    :style="{
      fontSize: `${fontSize}px`,
      fontWeight: fontWeight,
      color: textColor || undefined,
      background: (backgroundColor && !['glass', 'solid', 'transparent'].includes(backgroundColor))
        ? backgroundColor
        : undefined,
      borderColor: borderColor || undefined,
      borderRadius: `${borderRadius}px`,
      textAlign: textAlign,
      padding: `${padding}px`,
      justifyContent:
        textAlign === 'center'
          ? 'center'
          : textAlign === 'right'
            ? 'flex-end'
            : 'flex-start',
    }"
  >
    <span class="label-text">{{ displayedContent }}</span>
  </div>
</template>

<style scoped>
.text-label-widget {
  width: 100%;
  height: 100%;
  border-width: 1px;
  border-style: solid;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  backdrop-filter: blur(4px);
  transition: all 0.15s ease;
}

.label-text {
  width: 100%;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.35;
}
</style>
