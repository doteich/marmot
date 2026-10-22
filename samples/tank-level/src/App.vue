<script setup lang="ts">
import { ref } from 'vue'
import TankLevel from './TankLevel.vue'
import TankLevelConfig from './TankLevelConfig.vue'
</script>

<template>
  <section class="test-bench">

    <TankLevel class="widget"></TankLevel>
    <TankLevelConfig class="config"></TankLevelConfig>

  </section>

</template>


<style>
.test-bench {
  display: grid;
  grid-template-areas: "widget config";
  width: 100vw;
  height: 95vh;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  padding: 0;
  justify-content: center;
}

.widget {
  grid-area: widget;

  width: 100%;
}

.config {
  grid-area: config;
 
}
</style>