<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { EthWalletState, useAccountStore } from "./stores/web3";
import { onMounted, onUnmounted, watch } from "vue";
import OpenAppBanner from '@/components/common/OpenAppBanner.vue'
import BlinkSourceBanner from '@/components/common/BlinkSourceBanner.vue'
import { getChainPath } from '@/config/chains'
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
import { refreshRobinhoodBStockRegistry, registerRobinhoodStockCommunities } from "./config/bstocks";
import type { Community } from "./types";

import { startV13RegistrationSync } from '@/utils/v13/registration-sync';

let stopRegistrationSync: (() => void) | undefined;
onMounted(() => { stopRegistrationSync = startV13RegistrationSync(); });
onUnmounted(() => stopRegistrationSync?.());

const stateStore = useStateStore();
const chainStore = useChainStore();
const route = useRoute();
const router = useRouter();
const { setInter } = useInterval();
const { updateVPOP, updateUnreadMessageCount } = useAccount();

useDocumentTitle(route);

// A warm App Link changes the route without mounting App.vue again.
watch(() => [route.params.commerceid, route.params.chain], async () => {
  const id = route.params.commerceid
  if (route.name !== 'home' || typeof id !== 'string' || id.length <= 4) return
  const chainId = chainStore.activeChainId
  try {
    await router.replace({ path: getChainPath(chainId, `/commerce/${encodeURIComponent(id)}`), query: route.query, hash: route.hash })
  } catch (error) { console.warn('Unable to resolve shared content:', error) }
}, { immediate: true })

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
      registerRobinhoodStockCommunities(rows)
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

  getEthPrice().then((p: any) => {
      if (Number(p) > 0) stateStore.ethPrice = Number(p)
    }).catch(error => console.warn('[price] initial native price unavailable', error));
  let count = 0
  setInter(() => {
    getEthPrice().then((p: any) => {
      if (Number(p) > 0) stateStore.ethPrice = Number(p)
    }).catch(error => console.warn('[price] refresh failed; retaining last native price', error));
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
    <OpenAppBanner />
    <BlinkSourceBanner />
  </div>
</template>

<style scoped>
</style>
