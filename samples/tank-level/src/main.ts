import { createApp } from 'vue'
import App from './App.vue'
import { createOnyx } from "sit-onyx";
import "sit-onyx/style.css";


const app = createApp(App);
const onyx = createOnyx({});


app.use(onyx);


app.mount('#app')
