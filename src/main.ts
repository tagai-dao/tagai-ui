import "element-plus/dist/index.css"
import "element-plus/theme-chalk/dark/css-vars.css"
import "element-plus/theme-chalk/dark/css-vars.css"

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/lang";

import App from './App.vue'
import router from './router'
import './assets/style/main.css'
import { VueQrcodeReader } from 'vue-qrcode-reader';
import { initTheme } from '@/composables/useTheme'
import { initNativeApp } from '@/utils/native'

if ('serviceWorker' in navigator) {
    let refreshing = false
    // The generated worker calls skipWaiting(), but an already-open page keeps
    // executing its old contract ABI until it reloads. Refresh exactly once
    // when the new worker takes control so releases cannot leave stale writes.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
    })
}

// 在挂载前应用主题，避免暗/亮闪烁
initTheme()

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
app.use(VueQrcodeReader)

app.mount('#app')

initNativeApp(router).catch((error) => {
    console.error('Failed to initialize native app handlers:', error)
})
