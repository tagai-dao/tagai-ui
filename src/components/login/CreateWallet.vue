<script setup lang="ts">

import {WalletType} from "@/types";
import {ref} from "vue";

const connecting = ref(false)

const connect = async (type: WalletType) => {
  connecting.value = true
  try {
    if (type === WalletType.Unisat) {
      // await connectUnisat();
    } else if (type === WalletType.Okx) {
      // await connectOkx();
    }
  } catch (e) {

  } finally {
    connecting.value = false
  }
}

</script>

<template>
  <div class="flex flex-col justify-center min-h-[240px] py-6 px-4 gap-4">
    <div class="text-h2 text-black text-center">
      {{$t('loginView.createWallet')}}
    </div>
    <div class="text-base text-center text-grey-normal">
      {{$t('loginView.createWalletTip')}}
    </div>
    <div class="flex flex-col gap-3 w-full items-center text-18px pb-5">
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-4"
              :disabled="connecting"
              @click="connect(WalletType.Okx)">
        <img class="w-5 min-w-5 object-center object-contain" src="@/assets/icons/icon-wallet-okx.svg" alt="">
        <span class="text-h5 text-white uppercase">OKX wallet</span>
        <i-ep-loading v-if="connecting" class="animate-spin text-white"/>
      </button>
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-4"
              :disabled="connecting"
              @click="connect(WalletType.Unisat)">
        <img class="w-5 min-w-5 object-center object-contain" src="@/assets/icons/icon-wallet-unisat.svg" alt="">
        <span class="text-h5 text-white uppercase min-w-[3/5]">Unisat</span>
        <i-ep-loading v-if="connecting" class="animate-spin text-white"/>
      </button>
    </div>
  </div>
</template>

<style scoped>

</style>
