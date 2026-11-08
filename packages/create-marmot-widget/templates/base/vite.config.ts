import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Injects the widget's compiled CSS straight into the JavaScript bundle.
 *
 * External widgets ship as a single `bundle.js`, so styles must be attached
 * to the document at runtime. The `data-extension` attribute lets the Marmot
 * host identify (and scope) styles owned by this extension.
 */
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
            const injection = `(function(){try{var el=document.createElement('style');el.setAttribute('data-extension','{{WIDGET_ID}}');el.textContent=${JSON.stringify(cssCode)};document.head.appendChild(el);}catch(e){console.error('Failed to inject extension CSS',e);}})();\n`
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
    // Some dependencies probe process.env at runtime; provide a minimal shim
    // so the external bundle never crashes in the browser.
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: '{{WIDGET_ID}}',
      fileName: () => 'bundle.js',
      formats: ['es'],
    },
    rollupOptions: {
      // Vue MUST stay external. The Marmot host exposes a single shared Vue
      // runtime on window.__MARMOT_SDK__.vue (resolved via the host import map).
      // Bundling a second copy breaks reactivity across the host boundary.
      external: ['vue'],
      output: {
        globals: {
          vue: 'window.__MARMOT_SDK__.vue',
        },
      },
    },
  },
})
