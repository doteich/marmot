<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import DesignerHeader from '@/components/designer/DesignerHeader.vue'
import ComponentPalette from '@/components/designer/ComponentPalette.vue'
import DesignerCanvas from '@/components/canvas/DesignerCanvas.vue'
import PropertyInspector from '@/components/designer/PropertyInspector.vue'
import SvgBrowserModal from '@/components/modals/SvgBrowserModal.vue'
import SvgUploadModal from '@/components/modals/SvgUploadModal.vue'
import { useDesigner } from '@/composables/useDesigner'
import { useTelemetry } from '@/composables/useTelemetry'

const { addComponent, fetchDataPoints, fetchSites, activeSite, isPreviewMode } = useDesigner()
const { connect, disconnect } = useTelemetry()

watch(
  isPreviewMode,
  (testing) => {
    if (testing) {
      connect(activeSite.value?.wsUrl)
    } else {
      disconnect()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await fetchSites()
  fetchDataPoints()
})

onUnmounted(() => {
  disconnect()
})

const showBrowserModal = ref(false)
const showUploadModal = ref(false)

interface MachineLayoutPayload {
  name: string
  svgContent?: string
}

function handleSelectLayout(layout: MachineLayoutPayload) {
  addComponent('svg-machine', {
    name: layout.name,
    svgContent: layout.svgContent,
    bindings: [],
  })
}

function handleUploaded(layout: MachineLayoutPayload) {
  if (layout && layout.svgContent) {
    addComponent('svg-machine', {
      name: layout.name,
      svgContent: layout.svgContent,
      bindings: [],
    })
  }
}
</script>

<template>
  <div class="designer-layout">
    <DesignerHeader />
    <div class="designer-body">
      <ComponentPalette
        @open-browser="showBrowserModal = true"
        @open-upload="showUploadModal = true"
      />
      <DesignerCanvas />
      <PropertyInspector />
    </div>

    <!-- Modals -->
    <SvgBrowserModal
      v-if="showBrowserModal"
      @close="showBrowserModal = false"
      @select-layout="handleSelectLayout"
      @open-upload="showBrowserModal = false; showUploadModal = true"
    />

    <SvgUploadModal
      v-if="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="handleUploaded"
    />
  </div>
</template>

<style scoped>
.designer-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--app-bg);
  box-sizing: border-box;
}

.designer-body {
  display: flex;
  flex: 1;
  height: calc(100vh - 56px);
  overflow: hidden;
  box-sizing: border-box;
}
</style>
