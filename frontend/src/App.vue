<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useExtensionManager } from '@/composables/useExtensionManager'

const { initTheme } = useTheme()
const { initExtensions } = useExtensionManager()

onMounted(() => {
  initTheme()
  initExtensions()
})
</script>

<template>
  <RouterView />
</template>
