<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    errorMessage?: string
    type?: string
    backgroundColor?: string
    borderColor?: string
  }>(),
  {
    title: 'Extension Error',
    errorMessage: 'This widget could not be loaded or encountered a runtime error.',
    type: 'custom-widget',
    backgroundColor: '',
    borderColor: '',
  }
)

const displayMessage = computed(() => props.errorMessage || 'Failed to render extension.')
</script>

<template>
  <div
    class="widget-error-card widget-card widget-glass"
    :style="{
      borderColor: borderColor || 'rgba(239, 68, 68, 0.5)',
      background: backgroundColor && !['glass', 'solid', 'transparent'].includes(backgroundColor)
        ? backgroundColor
        : undefined,
    }"
  >
    <div class="error-badge">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span class="error-title">{{ title || 'Widget Failed to Load' }}</span>
    </div>

    <p class="error-desc">{{ displayMessage }}</p>
    <div class="error-footer">
      <span class="error-tag">{{ type }}</span>
      <span class="error-status">Protected by Error Boundary</span>
    </div>
  </div>
</template>

<style scoped>
.widget-error-card {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border-width: 1px;
  border-style: dashed;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  box-sizing: border-box;
  color: var(--canvas-theme-text, #f4f4f5);
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.4);
  user-select: none;
  overflow: hidden;
}

.error-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ef4444;
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-desc {
  font-size: 11px;
  color: var(--canvas-theme-muted, #94a3b8);
  margin: 6px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.error-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  padding-top: 6px;
}

.error-tag {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.error-status {
  color: var(--canvas-theme-muted, #94a3b8);
}
</style>
