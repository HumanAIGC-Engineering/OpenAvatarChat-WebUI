import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.less'
import App from './App.vue'
import i18n from './langs'
import vClickOutside from 'click-outside-vue3'

const app = createApp(App)
const Pinia = createPinia()
app.use(Pinia)
app.use(i18n)
app.use(vClickOutside)
app.mount('#app')
