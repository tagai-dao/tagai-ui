<script setup lang="ts">
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { computed, ref, watch } from "vue";
import ChoseWallet from '@/components/common/ChoseWallet.vue'
import { getProvider, getProviderInfo } from "@/utils/wallets";
import { ethers } from "ethers";

const accStore = useAccountStore();
const wallet = ref();
const loading = ref(false);
const step = ref('selectAddress')

const provider = computed(() => {
    return getProvider();
})

watch(() => accStore.ethConnectAddress, (address) => {
    if (ethers.isAddress(address)) {
        // check if address been bonded
    }
})

</script>

<template>
  <div v-if="accStore.ethConnectState !== EthWalletState.Connected">
    <ChoseWallet/>
  </div>
  <div v-else>
        <div v-if="step === 'selectAddress'">
            {{ accStore.ethConnectAddress }}
        </div>
  </div>
</template>
