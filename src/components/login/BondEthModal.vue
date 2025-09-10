<script setup lang="ts">
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { ref } from "vue";
import ChoseWallet from '@/components/login/ChoseWallet.vue';
import BindAddress from '@/components/login/BindAddress.vue';

const accStore = useAccountStore();

</script>

<template>
  <div v-if="accStore.ethConnectState !== EthWalletState.Connected && accStore.getAccountInfo?.walletType !== 1">
    <ChoseWallet/>
  </div>
  <div v-else>
    <BindAddress />
  </div>
</template>
