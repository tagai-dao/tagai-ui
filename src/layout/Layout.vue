<script setup lang="ts">
import {RouterView} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
import CreateCoinModal from "@/components/common/CreateCoinModal.vue";
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import AuthTwitter from "@/components/login/AuthTwitter.vue";
import BondEthModal from "@/components/login/BondEthModal.vue";
import ChoseWallet from "@/components/login/ChoseWallet.vue";

const modalStore = useModalStore()
</script>

<template>
  <main class="w-full h-full flex flex-col max-w-[1200px] mx-auto">
    <TopBar v-show="$route.meta.topBar"/>
    <div class="flex-1 overflow-hidden">
      <RouterView/>
    </div>
    <TabBar v-if="$route.meta.tabBar"/>
    <el-dialog v-model="modalStore.modalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <CreateCoinModal v-if="modalStore.modalType===GlobalModalType.CreateCoin"/>
      <CreateTweetModal v-if="modalStore.modalType===GlobalModalType.CreateTweet"/>
      <CreateSpaceModal v-if="modalStore.modalType===GlobalModalType.CreateTweetSpace"/>
      <AuthTwitter v-if="modalStore.modalType===GlobalModalType.Login"/>
      <BondEthModal v-if="modalStore.modalType===GlobalModalType.BondEth"/>
      <ChoseWallet v-if="modalStore.modalType === GlobalModalType.ChoseWallet" />
    </el-dialog>
  </main>
</template>

<style scoped>

</style>
