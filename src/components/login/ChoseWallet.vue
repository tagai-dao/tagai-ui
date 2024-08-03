<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { getProviders, setActiveProviderDetail } from "@/utils/wallets";
import { computed, ref } from "vue";

const loading = ref(false);
const providers = computed(() => {
  return getProviders() ?? [];
});

const emits = defineEmits(['chosedWallet'])

async function onSelectWalletMeta(wallet: any) {
  setActiveProviderDetail(wallet);
  useModalStore().setModalVisible(false)
  emits('chosedWallet')
}
</script>

<template>
    <div>
      Chose Wallet
      <button
        class="w-full mt-3 border-1 gradient-border shadow-shadow12 px-20px h-48px rounded-full flex justify-center items-center gap-10px hover:border-color85 mt-12px"
        v-for="wallet of providers"
        :key="wallet.info.uuid"
        :disabled="loading"
        @click="onSelectWalletMeta(wallet)"
      >
        <img class="w-10 h-10" :src="wallet.info.icon" alt="" />
        <div
          class="block min-w-100px ml-3 text-center flex justify-center items-center gap-4px text-gradient-primary"
        >
          <span class="font-bold">{{ wallet.info.name }}</span>
        </div>
      </button>
    </div>
  </template>
  