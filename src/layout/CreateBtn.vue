<script setup lang="ts">
import {GlobalModalType} from "@/types";
import {useAccountStore} from "@/stores/web3";
import {useModalStore} from "@/stores/common";
const accStore = useAccountStore()
const modalStore = useModalStore()

async function createCoin() {
  if (!accStore.ethConnectAddress) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }else {
    modalStore.setModalVisible(true, GlobalModalType.CreateCoin)
    return
  }
}
</script>

<template>
  <div>
    <button class="h-12 bg-gradient-primary px-6 rounded-full hidden web:flex items-center gap-2"
            @click="createCoin">
      <span class="text-white font-bold">{{$t('createCoin')}}</span>
      <img src="~@/assets/icons/icon-add.svg" alt="">
    </button>
    <button class="web:hidden absolute left-1/2 -top-5 transform -translate-x-1/2" @click="createCoin">
      <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
    </button>
  </div>
</template>

<style scoped>

</style>
