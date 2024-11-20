<script setup lang="ts">
import { useAccountStore } from "@/stores/web3";
import { ref, watch } from "vue";
import { ethers } from "ethers";
import { checkSolUsed, bondSol } from '@/apis/api'
import { BondSolMessage } from '@/config'
import { handleErrorTip } from "@/utils/notify";
import { useModalStore } from "@/stores/common";
import { useWallet, WalletMultiButton } from 'solana-wallets-vue'
import type { WalletName } from "@solana/wallet-adapter-base";
import { u8arryToHex } from '@/utils/helper'
const accStore = useAccountStore();
const loading = ref(false);
const solAddrUsed = ref(false);
const { signMessage, publicKey, select, connect, wallets, disconnect, readyState, ready, connecting } = useWallet()

async function checkSol(address: string | null | undefined): Promise<boolean> {
      // check if address been bonded
      if (!address) {
        return false
      }
      try {
        loading.value = true
        const acc: any = await checkSolUsed(address);
        if (acc.twitterId) {
          solAddrUsed.value = true;
          disconnect()
          return true
        } else {
          solAddrUsed.value = false;
          return false
        }
      } catch (error) {
        console.error(error);
        handleErrorTip(error);
        return false
      } finally {
        loading.value = false;
      }
}

watch(() => publicKey?.value?.toBase58(), (address) => {
  checkSol(address) 
}, { immediate: true })

async function confirm() {
  try{
    loading.value = true;
    if((await checkSol(accStore.solConnectAddress))) {
      return;
    }
    let signature = await signMessage.value!(new TextEncoder().encode(BondSolMessage));
    await bondSol(publicKey.value?.toBase58() || '', accStore.getAccountInfo!.twitterId, u8arryToHex(signature))
    accStore.setAccount({
      ...accStore.getAccountInfo!,
      solAddr: publicKey.value?.toBase58() || ''
    })
    useModalStore().setModalVisible(false)
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

function openDropdown() {
  console.log('openDropdown')
}

function sel() {
  console.log(wallets.value)
  select('Phantom' as WalletName)
}
</script>
<template>
  <div class="flex flex-col min-h-[240px] py-6 px-4 gap-7">
    <div class="text-h2 text-black text-center">
      {{$t('loginView.bindSolAddress')}}
    </div>
    <div class="flex flex-col w-full items-center px-8">
      <div class="text-base text-center text-red-e6 break-all">
        {{ publicKey?.toBase58() }}
      </div>
      <div v-show="solAddrUsed" class="text-base text-center text-red-e6 mt-3">{{ $t('loginView.addressUsed') }}</div>
    </div>
    <div v-if="!accStore.getAccountInfo?.solAddr && !publicKey?.toBase58()" class="flex flex-col gap-4">
      <div v-for="wallet in wallets" :key="wallet.adapter.name" 
        class="flex items-center justify-center gap-2"
        @click="select(wallet.adapter.name as WalletName)">
        <img class="w-12 h-12" :src="wallet.adapter.icon" alt="">
        <button class="text-h5 bg-gradient-primary flex items-center justify-center rounded-full px-4 py-2 text-white h-12 w-64"
          :disabled="connecting"
        >
          {{ wallet.adapter.name }}
        <i-ep-loading v-if="connecting" class="animate-spin text-white"/>
        </button>
      </div>
    </div>
    <div v-else class="px-5">
      <button class="h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-4"
        @click="confirm"
        :disabled="loading || solAddrUsed">
        <span class="text-h5 text-white">Confirm</span>
        <i-ep-loading v-if="loading" class="animate-spin text-white"/>
      </button>
      <div v-show="solAddrUsed" class="text-base text-center text-red-e6 mt-3">{{ $t('loginView.addressUsed') }}</div>
      <!-- <div class="text-base text-center text-red-e6 mt-3">钱包地址不匹配，请重新绑定</div> -->
    </div>
  </div>
</template>

<style scoped>

</style>
