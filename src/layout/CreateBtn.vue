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
    <button class="flex gap-2 items-center cursor-pointer"
            @click="createCoin">
      <img class="w-4" src="~@/assets/icons/icon-create.svg" alt="">
      <span class="whitespace-nowrap">{{$t('createCoin')}}</span>
    </button>
<!--    <button class="web:hidden absolute left-1/2 -top-5 transform -translate-x-1/2" @click="createCoin">-->
<!--      <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">-->
<!--    </button>-->
  </div>
</template>

<style scoped>

</style>
