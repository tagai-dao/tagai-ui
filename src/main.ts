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

// Register the native return listener before Privy mounts (including cold starts).
initNativeApp(router).catch(() => {
    console.error('Failed to initialize native app handlers')
}).finally(() => app.mount('#app'))

void import('@/utils/androidUpdates').then(({ initAndroidUpdates }) => initAndroidUpdates())
    .catch(error => console.warn('Update checker initialization failed:', error))
