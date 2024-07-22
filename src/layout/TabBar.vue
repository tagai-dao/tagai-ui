<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";
import ProfileBtn from "@/layout/ProfileBtn.vue";

const accStore = useAccountStore()
const modalStore = useModalStore()

const { vp, op } = useAccount()

async function createCoin() {
  const acc = accStore.getAccountInfo;
  if (!acc) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }else if (!acc.ethAddr) {
    modalStore.setModalVisible(true, GlobalModalType.BondEth)
    return
  }else {
    modalStore.setModalVisible(true, GlobalModalType.CreateCoin)
    return
  }
}
</script>

<template>
  <div class="relative">
    <div class="absolute h-[76px] left-0 right-0 bottom-0 flex items-center justify-center rounded-md overflow-hidden">
      <div class="flex-1 h-full bg-gradient-tab"></div>
      <img class="h-full object-cover object-center" src="~@/assets/images/tabbar-bg.svg" alt="">
      <div class="flex-1 h-full bg-gradient-tab"></div>
    </div>
    <div class="w-full flex justify-between items-end px-8 py-4 relative z-10">
      <router-link to="/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
        <template v-if="$route.name==='home'">
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
          <span class="text-gradient bg-gradient-primary text-h5">Tag</span>
        </template>
        <template v-else>
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
          <span class="text-h5 text-grey-normal">Tag</span>
        </template>
      </router-link>
      <button class="mb-9" @click="createCoin">
        <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
      </button>
      <ProfileBtn class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
      </ProfileBtn>
    </div>
  </div>
</template>

<style scoped>

</style>
