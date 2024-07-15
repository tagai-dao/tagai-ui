<script setup lang="ts">
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { ref } from "vue";
import ChoseWallet from '@/components/login/ChoseWallet.vue';
import BindAddress from '@/components/login/BindAddress.vue';

const accStore = useAccountStore();
const step = ref('selectAddress')

</script>

<template>
  <div v-if="accStore.ethConnectState !== EthWalletState.Connected">
    <ChoseWallet/>
  </div>
  <div v-else>
        <div v-if="step === 'selectAddress'">
            <BindAddress />
        </div>
  </div>
</template>
