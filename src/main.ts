import "element-plus/dist/index.css"

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from "vue3-apexcharts";
import i18n from "@/lang";
import SolanaWallets from 'solana-wallets-vue';
import "solana-wallets-vue/styles.css";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from '@solana/web3.js'

import App from './App.vue';
import router from './router';
import './assets/style/main.css'

// 设置网络为Mainnet
const network = WalletAdapterNetwork.Mainnet

const walletOptions = {
    wallets: [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ],
    autoConnect: true,
    network,
    endpoint: clusterApiUrl(network)
}

const app = createApp(App)
app.config.globalProperties.$apexcharts = VueApexCharts;

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(VueApexCharts)
app.use(SolanaWallets, walletOptions)
app.mount('#app')
