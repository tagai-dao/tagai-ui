<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { useAccountStore } from "./stores/web3";
import { onMounted } from "vue";
import { GlobalModalType } from "@/types";
import { initPlugin } from "./utils/wallets";
import { getBtcPrice, getUserProfile } from "@/apis/api"
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
