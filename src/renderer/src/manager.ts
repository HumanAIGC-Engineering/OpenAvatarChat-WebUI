import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.less'
import '@vue-flow/core/dist/style.css'

/* this contains the default theme, these are optional styles */
import '@vue-flow/core/dist/theme-default.css'
import ManagerApp from './ManagerApp.vue'

const app = createApp(ManagerApp)
const pinia = createPinia()

app.use(pinia)
app.mount('#manager-app')
