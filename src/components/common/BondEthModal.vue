<script lang="ts">
import { getProviders, setActiveProviderDetail } from "@/utils/wallets";
import { computed, ref } from "vue";

const wallet = ref();
const loading = ref(false);
const providers = computed(() => {
  return getProviders() ?? [];
});

async function onSelectWalletMeta(wallet: any) {
  setActiveProviderDetail(wallet);
  wallet.value = wallet;
}
</script>

<template>
  <div>
    BondEth
    <template>
      <button
        class="w-full border-1 gradient-border shadow-shadow12 px-20px h-48px rounded-full flex justify-center items-center gap-10px hover:border-color85 mt-12px"
        v-for="wallet of providers"
        :key="wallet.info.uuid"
        :disabled="loading"
        @click="onSelectWalletMeta(wallet)"
      >
        <img class="w-20px h-20px" :src="wallet.info.icon" alt="" />
        <div
          class="block min-w-100px text-center flex justify-center items-center gap-4px text-gradient-primary"
        >
          <!-- <span v-if="installWallet" class="">Install</span> -->
          <span class="font-bold">{{ wallet.info.name }}</span>
        </div>
        <!-- <img
          v-if="loading"
          class="c-loading w-18px h-18px"
          src="~@/assets/btn-loading.svg"
          alt=""
        /> -->
      </button>
    </template>
  </div>
</template>
