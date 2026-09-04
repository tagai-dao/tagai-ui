<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { EthWalletState, useAccountStore } from "./stores/web3";
import { onMounted, onUnmounted } from "vue";
import { GlobalModalType } from "@/types";
import { initPlugin } from "./utils/wallets";
import { getEthPrice, getImportedCommunityInfo, getUserProfile, resolveCommerce } from "@/apis/api"
import { getIPShareSupply } from "@/utils/ipshare";
import { useInterval } from "./composables/useTools";
import { useAccount } from "./composables/useAccount";
import emitter from "./utils/emitter";
import { isAddress } from "viem";
import { useDocumentTitle } from "./composables/useDocumentTitle";
import { useChainStore } from "./stores/chain";
import { refreshRobinhoodBStockRegistry } from "./config/bstocks";
import type { Community } from "./types";

const stateStore = useStateStore();
const chainStore = useChainStore();
const route = useRoute();
const router = useRouter();
const { setInter } = useInterval();
const { updateVPOP, updateUnreadMessageCount } = useAccount();

useDocumentTitle(route);

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

async function updateIPShare() {
  if (isAddress(useAccountStore().getAccountInfo.ethAddr ?? '')) {
    const supply = await getIPShareSupply(useAccountStore().getAccountInfo.ethAddr ?? '');
    if (supply >= 10) {
      useAccountStore().ipshare = {
        ethAddr: useAccountStore().getAccountInfo.ethAddr ?? '',
        shareSupply: supply,
        created: true
      }
    }
  }
}

onMounted(async () => {
  await router.isReady();
  
  initPlugin();
  if (chainStore.deployment.key === 'rh') {
    // Preload the Router-backed stock registry without blocking first paint.
    getImportedCommunityInfo().then((communities) => {
      const rows = (communities || []) as Community[]
      return refreshRobinhoodBStockRegistry(rows.map((community) => community.token))
    }).catch((error) => {
      console.error('Preload RH Router-supported stocks error:', error)
    })
  }
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
    }).catch()
    updateIPShare().catch();
    if (account.walletType === 0 && account.ethAddr && isAddress(account.ethAddr)) {
        // user connect wallet plugin by manual
        useAccountStore().ethConnectState = EthWalletState.Disconnect;
      }
  } else {
    useAccountStore().ethConnectState = EthWalletState.Disconnect;
  }

  if (typeof(route.params.commerceid) === 'string' && route.params.commerceid.length > 4) {
    const commerceId = route.params.commerceid
    resolveCommerce(commerceId).then((res: any) => {
      if (res?.c !== 0 || !res?.d) return
      const { commerceType, tweetId, fpmm, tick } = res.d
      // 预测类 commerce：推文已绑定且有关联 fpmm 时，进预测详情页
      if (tweetId && fpmm && commerceType === 2) {
        router.replace(`/predict/battle/${fpmm}`)
      } else if (tweetId && fpmm && commerceType === 3) {
        router.replace(`/predict/event/${fpmm}`)
      } else if (tweetId) {
        router.replace('/post-detail/' + tweetId)
      } else if (tick) {
        router.replace('/tag-detail/' + tick)
      }
    }).catch()
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
  emitter.on('login', updateIPShare);
  // 注意：登录回跳（login-redirect）不在这里处理——login 事件发生在 OAuth/钱包
  // 流程中途，此时导航会与 Privy 后续步骤竞争导致 authError。
  // 回跳统一放在 Layout.setWallet 的收尾（见 Layout.vue）。

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
