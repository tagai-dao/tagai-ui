import "element-plus/dist/index.css"

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/lang";
import SolanaWallets from 'solana-wallets-vue';
import "solana-wallets-vue/styles.css";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

import App from './App.vue';
import router from './router';
import './assets/style/main.css'

const app = createApp(App)
app.config.globalProperties.$apexcharts = VueApexCharts;

const walletoptions = {
    wallets: [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ],
    autoConnect: true
}

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(VueApexCharts)
app.use(SolanaWallets, walletoptions)
app.mount('#app')
