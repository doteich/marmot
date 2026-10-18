    import { defineConfig } from 'vite'                                                                                                 
    import vue from '@vitejs/plugin-vue'                                                                                                
                                                                                                                                        
    export default defineConfig({                                                                                                       
      plugins: [vue()],                                                                                                                 
      build: {                                                                                                                          
        lib: {                                                                                                                          
          entry: 'src/index.ts',                                                                                                        
          name: 'tank-level',                                                                                                             
          fileName: () => 'bundle.js',                                                                                                  
          formats: ['es'],                                                                                                              
        },                                                                                                                              
        rollupOptions: {                                                                                                                
          external: ['vue', 'chart.js', 'sit-onyx', '@sit-onyx/icons'],                                                                 
          output: {                                                                                                                     
            globals: {                                                                                                                  
              vue: 'window.__MARMOT_SDK__.vue',                                                                                         
              'chart.js': 'window.__MARMOT_SDK__.chartjs',                                                                              
              '@sit-onyx/icons': 'window.__MARMOT_SDK__.icons',                                                                         
            },                                                                                                                          
          },                                                                                                                            
        },                                                                                                                              
      },                                                                                                                                
    })         