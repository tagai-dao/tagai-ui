<script setup lang="ts">
import Layout from "@/layout/Layout.vue";
import {useRoute, useRouter} from "vue-router";
import { useStateStore, useModalStore } from "./stores/common";
import { useAccountStore } from "./stores/web3";
import { onMounted } from "vue";
import { GlobalModalType } from "./types";

const stateStore = useStateStore();
const route = useRoute();
const router = useRouter();

onMounted(async () => {
  await router.isReady();
  const { referee } = route.query;
  if (referee) {
    stateStore.referee = referee as string;
    if (!useAccountStore().account?.twitterId) {
      useModalStore().setModalVisible(true, GlobalModalType.Login)
    }
  }
})
</script>

<template>
  <div id="app" :class="route.name==='home'?'bg-img-home':'bg-img-common'">
    <Layout></Layout>
  </div>
</template>

<style scoped>
</style>
