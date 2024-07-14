<script setup lang="ts">
import {RouterView} from "vue-router";
import TopBar from "@/layout/TopBar.vue";
import TabBar from "@/layout/TabBar.vue";
import CreateCoinModal from "@/components/common/CreateCoinModal.vue";
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import CreateTweetModal from "@/components/common/CreateTweetModal.vue";
import CreateSpaceModal from "@/components/common/CreateSpaceModal.vue";
import LoginModal from '@/components/login/LoginModal.vue'
import BondEthModal from '@/components/common/BondEthModal.vue'

const modalStore = useModalStore()
</script>

<template>
  <main class="w-full h-full flex flex-col max-w-[1200px] mx-auto">
    <TopBar/>
    <div class="flex-1 overflow-hidden">
      <RouterView/>
    </div>
    <TabBar/>
    <el-dialog v-model="modalStore.modalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <CreateCoinModal v-if="modalStore.modalType===GlobalModalType.CreateCoin"/>
      <CreateTweetModal v-if="modalStore.modalType===GlobalModalType.CreateTweet"/>
      <CreateSpaceModal v-if="modalStore.modalType===GlobalModalType.CreateTweetSpace"/>
      <LoginModal v-if="modalStore.modalType===GlobalModalType.Login"/>
      <BondEthModal v-if="modalStore.modalType === GlobalModalType.BondEth"/>
    </el-dialog>
  </main>
</template>

<style scoped>

</style>
