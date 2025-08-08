<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { useAccountStore } from "./stores/web3";
import { onMounted, onUnmounted } from "vue";
import { GlobalModalType } from "@/types";
import { initPlugin } from "./utils/wallets";
import { getEthPrice, getUserProfile, redirectTweet } from "@/apis/api"
import { useInterval } from "./composables/useTools";
import { useAccount } from "./composables/useAccount";
import emitter from "./utils/emitter";
import { useUserStore } from "./stores/privy";
import { privy } from "./utils/privy";

const stateStore = useStateStore();
const privyStore = useUserStore();
const route = useRoute();
const router = useRouter();
const { setInter } = useInterval();
const { updateVPOP, updateUnreadMessageCount } = useAccount();

function updateOgUrl() {
    const currentUrl = window.location.href;
    const ogUrlMeta = document.querySelector('meta[property="og:url"]');
    
    if (ogUrlMeta) {
      ogUrlMeta.setAttribute('content', currentUrl);
    } else {
      const metaTag = document.createElement('meta');
      metaTag.setAttribute('property', 'og:url');
      metaTag.setAttribute('content', currentUrl);
      document.head.appendChild(metaTag);
    }
  }

onMounted(async () => {
  await router.isReady();

  
  initPlugin();
  const { referee } = route.query;
  const account = useAccountStore().getAccountInfo
  if (referee) {
    stateStore.referee = referee as string;
    if (!account?.twitterId) {
      useModalStore().setModalVisible(true, GlobalModalType.Login)
    }
  }

  // useModalStore().setModalVisible(true, GlobalModalType.Register)

  // update userinfo
  if (account?.twitterId) {
    getUserProfile(account.twitterId).then(async (acc: any) => {
      useAccountStore().setAccount({
        ...account,
        ...acc
      })
      if (acc?.walletType === 1) {
        // 初始化privy iframe - 在应用启动时就准备好
        try {
          console.log('Initializing Privy iframe on app startup...');
          await privyStore.initPrivyIframe();
          console.log('Privy iframe initialized successfully', privyStore.iframeInitialized);
          if (!privyStore.iframeInitialized) {
            console.log('Waiting for Privy iframe initialization...');
            await privyStore.waitForIframeInitialization();
            console.log('Privy iframe initialized successfully', privyStore.iframeInitialized);
          }
          
          // privy准备完成后，调用initWallet方法
          console.log('Privy iframe ready, initializing wallet...');
          await privyStore.initWallet();
          console.log('Wallet initialization completed');
        } catch (error) {
          console.error('Failed to initialize Privy iframe or wallet:', error);
          // 即使初始化失败，应用仍然可以继续运行
        }
      }else {
        useAccountStore().ethWalletType = 'metamask';
      }
    }).catch()
  }

  if (typeof(route.params.commerceid) === 'string' && route.params.commerceid.length > 4) {
    redirectTweet(route.params.commerceid).then((tweetId: any) => {
      if (tweetId) {
        router.replace('/post-detail/' + tweetId)
      }
    })
  }

  getEthPrice().then((p: any) => {
      stateStore.ethPrice = p
    }).catch();
  let count = 0
  setInter(() => {
    getEthPrice().then((p: any) => {
      stateStore.ethPrice = parseFloat(p)
    }).catch();
    updateVPOP();
    if (count++ % 6 == 0)
      updateUnreadMessageCount();
  }, 30000)
  emitter.on('login', updateVPOP);
  emitter.on('login', updateUnreadMessageCount);

  updateOgUrl();
})

// 应用退出时不清理privy资源，保持iframe在整个应用生命周期中存在
</script>

<template>
  <div id="app" :class="route.name==='home'?'bg-img-home':'bg-img-common'">
    <Layout></Layout>
  </div>
</template>

<style scoped>
</style>
