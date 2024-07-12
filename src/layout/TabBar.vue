<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import { useAccountStore } from "@/stores/web3";

const accStore = useAccountStore()
const modalStore = useModalStore()

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
  <div class="h-24 w-full bg-white flex justify-between items-center px-8 py-4">
    <router-link to="/" class="flex flex-col items-center cursor-pointer gap-0.5 px-2">
      <template v-if="$route.name==='home'">
        <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <span class="text-gradient bg-gradient-primary text-h5">Tag</span>
      </template>
      <template v-else>
        <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
        <span class="text-h5 text-grey-normal">Tag</span>
      </template>
    </router-link>
    <button class="mb-6" @click="createCoin">
      <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
    </button>
    <router-link to="/profile/1" class="flex flex-col items-center cursor-pointer gap-0.5 px-2">
      <template>
        <img class="w-6 h-6" :src="accStore.getAccountInfo ? accStore.getAccountInfo.profile.replace('normal', '200x200') : '~@/assets/icons/icon-tabbar-profile.svg'" alt="">
        <span class="text-h5 text-grey-normal">Profile</span>
      </template>
    </router-link>
  </div>
</template>

<style scoped>

</style>
