import { createApp } from 'vue'
import { createOnyx } from 'sit-onyx'
import App from './App.vue'
import router from './router'

import 'sit-onyx/style.css'
import 'sit-onyx/global.css'
import './plugins/chart'
import './assets/main.css'

import * as Vue from 'vue'
import * as OnyxIcons from '@sit-onyx/icons'
import * as ChartJS from 'chart.js'

declare global {
  interface Window {
    __MARMOT_SDK__?: {
      vue: typeof Vue
      icons: typeof OnyxIcons
      chartjs: typeof ChartJS
    }
  }
}

window.__MARMOT_SDK__ = {
  vue: Vue,
  icons: OnyxIcons,
  chartjs: ChartJS,
}

const app = createApp(App)
const onyx = createOnyx({ router })

app.use(onyx)
app.use(router)

app.mount('#app')
