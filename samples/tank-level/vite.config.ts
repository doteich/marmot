import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

function cssInjectedByJsPlugin(): Plugin {
  return {
    name: 'css-injected-by-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      let cssCode = ''
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && 'source' in asset) {
          cssCode += String(asset.source)
          delete bundle[fileName]
        }
      }
      if (cssCode) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (fileName.endsWith('.js') && 'code' in chunk) {
            const injection = `(function(){try{var el=document.createElement('style');el.setAttribute('data-extension','tank-level');el.textContent=${JSON.stringify(cssCode)};document.head.appendChild(el);}catch(e){console.error('Failed to inject extension CSS',e);}})();\n`
            chunk.code = injection + chunk.code
            break
          }
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'tank-level',
      fileName: () => 'bundle.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'window.__MARMOT_SDK__.vue',
        },
      },
    },
  },
})
