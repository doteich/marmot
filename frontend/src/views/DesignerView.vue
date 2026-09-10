<script setup lang="ts">
import DesignerHeader from '@/components/designer/DesignerHeader.vue'
import ComponentPalette from '@/components/designer/ComponentPalette.vue'
import DesignerCanvas from '@/components/canvas/DesignerCanvas.vue'
import PropertyInspector from '@/components/designer/PropertyInspector.vue'
</script>

<template>
  <div class="designer-layout">
    <DesignerHeader />
    <div class="designer-body">
      <ComponentPalette />
      <DesignerCanvas />
      <PropertyInspector />
    </div>
  </div>
</template>

<style scoped>
.designer-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #09090b;
}

.designer-body {
  display: flex;
  flex: 1;
  height: calc(100vh - 56px);
  overflow: hidden;
}
</style>
