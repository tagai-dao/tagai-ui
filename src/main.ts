import "element-plus/dist/index.css"

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/lang";

import App from './App.vue'
import router from './router'
import './assets/style/main.css'

import { createRoot } from 'react-dom/client'
import { setVeauryOptions } from 'veaury'
setVeauryOptions({
    react: {
        createRoot
    }
})

const app = createApp(App)
app.config.globalProperties.$apexcharts = VueApexCharts;

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(VueApexCharts as any)

app.mount('#app')
