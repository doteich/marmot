<script setup lang="ts">
defineProps<{
  element?: {
    id: string
    type: string
    props?: Record<string, unknown>
  }
}>()
</script>

<template>
  <div class="error-config-panel">
    <div class="alert-box">
      <div class="alert-header">
        <span class="alert-title">Extension Load Failure</span>
      </div>
      <p class="alert-msg">
        The extension module for this widget failed to load or is currently disabled in the Extension Registry.
      </p>
    </div>

    <div class="field-group">
      <label class="field-label">Widget Type</label>
      <input type="text" class="field-input" :value="element?.type" readonly />
    </div>

    <div class="field-group">
      <label class="field-label">Element ID</label>
      <input type="text" class="field-input" :value="element?.id" readonly />
    </div>

    <p class="help-text">
      Visit the Admin Panel &gt; Widget Extensions tab to verify the extension bundle status or reinstall it.
    </p>
  </div>
</template>

<style scoped>
.error-config-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
}

.alert-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 10px;
}

.alert-header {
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 4px;
}

.alert-msg {
  font-size: 12px;
  color: var(--canvas-theme-muted, #94a3b8);
  line-height: 1.4;
  margin: 0;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--canvas-theme-muted, #94a3b8);
  text-transform: uppercase;
}

.field-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--canvas-theme-border, #334155);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--canvas-theme-text, #f8fafc);
  font-size: 12px;
  font-family: monospace;
}

.help-text {
  font-size: 11px;
  color: var(--canvas-theme-muted, #94a3b8);
  font-style: italic;
  margin: 0;
}
</style>
