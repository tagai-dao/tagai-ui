<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { getProviders, setActiveProviderDetail } from "@/utils/wallets";
import { computed, ref, watch } from "vue";
import { useWallet, WalletMultiButton } from "solana-wallets-vue";
import type { WalletName } from "@solana/wallet-adapter-base";
import { EthWalletState, useAccountStore } from "@/stores/web3";

const modalStore = useModalStore();
const loading = ref(false);
const providers = computed(() => {
  return getProviders() ?? [];
});
const accStore = useAccountStore();

const { wallets, connecting, select, readyState, publicKey } = useWallet();

const emits = defineEmits(['chosedWallet'])

watch(readyState, (val) => {
  console.log('readyState', val)
})

watch(publicKey, (val) => {
  console.log('publicKey', val)
  if (val) {
    accStore.solConnectAddress = val.toBase58()
    accStore.ethConnectState = EthWalletState.Connected
    emits('chosedWallet', val.toBase58())
  }
})

</script>

<template>
  <div class="px-1 flex flex-col gap-y-5">
      <div class="flex justify-between items-center">
        <span class="text-h2 text-grey-normal-hover">{{$t('loginView.choseWallet')}}</span>
        <img class="cursor-pointer" src="~@/assets/icons/icon-modal-close.svg" alt=""
             @click="modalStore.setModalVisible(false)"/>
      </div>
      <div v-for="wallet in wallets" :key="wallet.adapter.name"
        class="flex items-center justify-center gap-5"
        @click="select(wallet.adapter.name as WalletName)">
        <img class="w-12 h-12" :src="wallet.adapter.icon" alt="">
        <button class="text-h5 bg-gradient-primary flex items-center justify-center rounded-full px-6 py-4 text-white h-12 w-64"
          :disabled="connecting"
        >
          {{ wallet.adapter.name }}
        <i-ep-loading v-if="connecting" class="animate-spin text-white"/>
        </button>
      </div>
    </div>
  </template>
