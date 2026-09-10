import { createApp } from 'vue'
import { createOnyx } from 'sit-onyx'
import App from './App.vue'
import router from './router'

import 'sit-onyx/style.css'
import 'sit-onyx/global.css'

const app = createApp(App)
const onyx = createOnyx({ router })

app.use(onyx)
app.use(router)

app.mount('#app')
