<script setup lang="ts">
import {GlobalModalType} from "@/types";
import {useAccountStore} from "@/stores/web3";
import {useModalStore} from "@/stores/common";
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
  <button class="h-12 bg-gradient-primary px-6 rounded-full hidden web:flex items-center gap-2"
          @click="createCoin">
    <span class="text-white font-bold">{{$t('createCoin')}}</span>
    <img src="~@/assets/icons/icon-add.svg" alt="">
  </button>
  <button class="web:hidden mb-9" @click="createCoin">
    <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
  </button>
</template>

<style scoped>

</style>
