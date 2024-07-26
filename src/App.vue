<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { useAccountStore } from "./stores/web3";
import { onMounted } from "vue";
import { GlobalModalType } from "@/types";
import { initPlugin } from "./utils/wallets";
import { getBtcPrice, getUserProfile, redirectTweet } from "@/apis/api"
import { useInterval } from "./composables/useTools";
import { useAccount } from "./composables/useAccount";

const stateStore = useStateStore();
const route = useRoute();
const router = useRouter();
const { setInter } = useInterval();
const { updateVPOP } = useAccount();

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
  // update userinfo
  if (account?.twitterId) {
    getUserProfile(account.twitterId).then((acc: any) => {
      useAccountStore().setAccount({
        ...account,
        ...acc
      })
    }).catch()
  }
  getBtcPrice().then((p: any) => {
      stateStore.btcPrice = p
    })
  setInter(() => {
    getBtcPrice().then((p: any) => {
      stateStore.btcPrice = parseFloat(p)
    })
    updateVPOP();
  }, 10000)
})
</script>

<template>
  <div id="app" :class="route.name==='home'?'bg-img-home':'bg-img-common'">
    <Layout></Layout>
  </div>
</template>

<style scoped>
</style>
