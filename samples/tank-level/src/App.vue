    <script setup lang="ts">                                                                                                             
    import { ref } from 'vue'                                                                                                            
    import TankLevel from './TankLevel.vue'                                                                                              
    import TankLevelConfig from './TankLevelConfig.vue'                                                                                  
                                                                                                                                         
    const currentLevel = ref(650) // Simulated live telemetry value                                                                      
    const widgetProps = ref({                                                                                                            
      title: 'Storage Tank A',                                                                                                           
      capacity: 1000,                                                                                                                    
      unit: 'L',                                                                                                                         
      fillColor: '#0284c7',                                                                                                              
      backgroundColor: 'glass',                                                                                                          
    })                                                                                                                                   
    </script>                                                                                                                            
                                                                                                                                         
    <template>                                                                                                                           
      <div style="display: flex; gap: 40px; padding: 40px; background: #18181b; min-height: 100vh; color: white;">                       
        <!-- Live Widget Preview -->                                                                                                     
        <div style="width: 200px; height: 300px;">                                                                                       
          <TankLevel                                                                                                                     
            v-bind="widgetProps"                                                                                                         
            :data-point="'sim.tank.level'"                                                                                               
            :telemetry-values="{ 'sim.tank.level': currentLevel }"                                                                       
          />                                                                                                                             
        </div>                                                                                                                           
                                                                                                                                         
        <!-- Inspector / Simulation Controls -->                                                                                         
        <div style="width: 320px; display: flex; flex-direction: column; gap: 16px;">                                                    
          <h3>Telemetry Simulator</h3>                                                                                                   
          <label>Level: {{ currentLevel }} L</label>                                                                                     
          <input type="range" min="0" :max="widgetProps.capacity" v-model.number="currentLevel" />                                       
                                                                                                                                         
          <h3>Config Panel Preview</h3>                                                                                                  
          <!-- Simulated component wrapper -->                                                                                           
          <TankLevelConfig :component="{ id: 'tank-1', props: widgetProps }" />                                                          
        </div>                                                                                                                           
      </div>                                                                                                                             
    </template>