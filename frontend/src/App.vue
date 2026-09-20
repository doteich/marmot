<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})
</script>

<template>
  <RouterView />
</template>

<style>
/* CSS Variables for Dark / Light Theme */
:root {
  /* Light Theme tokens */
  --app-bg: #f8fafc;
  --app-surface: #ffffff;
  --app-surface-hover: #f1f5f9;
  --app-surface-subtle: #f8fafc;
  --app-border: #e2e8f0;
  --app-border-strong: #cbd5e1;
  --app-text: #0f172a;
  --app-text-muted: #64748b;
  --app-input-bg: #ffffff;
  --app-input-border: #cbd5e1;
  --canvas-bg: #f1f5f9;
  --canvas-dots: rgba(0, 0, 0, 0.12);
  --app-accent: #0284c7;
  --app-accent-hover: #0369a1;
}

:root.dark,
html.dark {
  /* Dark Theme tokens */
  --app-bg: #09090b;
  --app-surface: #18181b;
  --app-surface-hover: #27272a;
  --app-surface-subtle: #121215;
  --app-border: #27272a;
  --app-border-strong: #3f3f46;
  --app-text: #f4f4f5;
  --app-text-muted: #a1a1aa;
  --app-input-bg: #18181b;
  --app-input-border: #3f3f46;
  --canvas-bg: #09090b;
  --canvas-dots: rgba(255, 255, 255, 0.1);
  --app-accent: #0284c7;
  --app-accent-hover: #38bdf8;
}

/* Global Font Consistency */
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--app-bg);
  color: var(--app-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Enforce font family across all HTML controls */
button,
input,
select,
textarea,
optgroup {
  font-family: inherit;
}
</style>
