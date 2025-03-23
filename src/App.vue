<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { useAccountStore } from "./stores/web3";
import { onMounted } from "vue";
import { GlobalModalType } from "@/types";
import { initPlugin } from "./utils/wallets";
import { getEthPrice, getUserProfile, redirectTweet } from "@/apis/api"
import { useInterval } from "./composables/useTools";
import { useAccount } from "./composables/useAccount";
import emitter from "./utils/emitter";

const stateStore = useStateStore();
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
  if (typeof(route.params.commerceid) === 'string' && route.params.commerceid.length > 4) {
    redirectTweet(route.params.commerceid).then((tweetId: any) => {
      if (tweetId) {
        router.replace('/post-detail/' + tweetId)
      }
    })
  }

  // useModalStore().setModalVisible(true, GlobalModalType.Register)

  // update userinfo
  if (account?.twitterId) {
    getUserProfile(account.twitterId).then((acc: any) => {
      useAccountStore().setAccount({
        ...account,
        ...acc
      })
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

  updateOgUrl();
})
</script>

<template>
  <div id="app" :class="route.name==='home'?'bg-img-home':'bg-img-common'">
    <Layout></Layout>
  </div>
</template>

<style scoped>
</style>
