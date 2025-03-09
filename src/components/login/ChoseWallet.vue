<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { getProviders, setActiveProviderDetail, setMetaMaskSDK } from "@/utils/wallets";
import { computed, ref } from "vue";

const modalStore = useModalStore();
const loading = ref(false);
const providers = computed(() => {
  return getProviders() ?? [];
});

const emits = defineEmits(['chosedWallet'])

async function onSelectWalletMeta(wallet: any) {
  setActiveProviderDetail(wallet);
  emits('chosedWallet')
}

async function connectMetaMask() {
  setMetaMaskSDK();
  emits('chosedWallet')
}
</script>

<template>
  <div class="px-1 flex flex-col gap-y-2">
      <div class="flex justify-between items-center">
        <span class="text-h2 text-grey-normal-hover">{{$t('loginView.choseWallet')}}</span>
        <img class="cursor-pointer" src="~@/assets/icons/icon-modal-close.svg" alt=""
             @click="modalStore.setModalVisible(false)"/>
      </div>
      <div class="flex flex-col gap-2 pt-4 pb-6" v-if="providers.length > 0">
        <button
            class="w-full border-[1px] border-grey-light-active shadow-shadow12 px-5 h-12 rounded-full
                   flex justify-center items-center gap-10px
                   hover:border-orange-normal hover:bg-gradient-primary hover:text-white"
            v-for="wallet of providers"
            :key="wallet.info.uuid"
            :disabled="loading"
            @click="onSelectWalletMeta(wallet)"
        >
          <img class="w-8 h-8" :src="wallet.info.icon" alt="" />
          <span class="min-w-[100px] ml-3 text-center flex justify-center items-center gap-1 text-lg font-semibold">
            {{ wallet.info.name }}
          </span>
        </button>
      </div>
      <div class="flex flex-col gap-2 pt-4 pb-6" v-else>
        <button
            class="w-full border-[1px] border-grey-light-active shadow-shadow12 px-5 py-1 h-12 rounded-full
                   flex justify-center items-center gap-10px
                   hover:border-orange-normal hover:bg-gradient-primary hover:text-white"
            :disabled="loading"
            @click="connectMetaMask()"
        >
          <img class="h-full" src="https://docs.metamask.io/img/metamask-logo.svg" alt="" />
          <!-- <span class="min-w-[100px] ml-3 text-center flex justify-center items-center gap-1 text-lg font-semibold">
            MetaMask
          </span> -->
        </button>
      </div>
    </div>
  </template>
