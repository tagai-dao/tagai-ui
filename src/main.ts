import "element-plus/dist/index.css"

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/lang";

import App from './App.vue'
import router from './router'
import './assets/style/main.css'

const app = createApp(App)
app.config.globalProperties.$apexcharts = VueApexCharts;

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(VueApexCharts)

app.mount('#app')
