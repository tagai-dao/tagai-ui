<script setup lang="ts">
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { computed, ref } from "vue";
import ChoseWallet from '@/components/common/ChoseWallet.vue'
import { getProvider, getProviderInfo } from "@/utils/wallets";

const accStore = useAccountStore();
const wallet = ref();
const loading = ref(false);
const step = ref('selectAddress')

const provider = computed(() => {
    return getProvider();
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
