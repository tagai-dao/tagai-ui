<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { getProviders, setActiveProviderDetail, setMetaMaskSDK } from "@/utils/wallets";
import { computed, ref, onMounted } from "vue";
import { useUserStore } from "@/stores/privy";
import { usePrivyIframe } from "@/composables/usePrivyIframe";

const store = useUserStore();
const modalStore = useModalStore();
const loading = ref(false);
const initedPrivy = ref(false);
const providers = computed(() => {
  return getProviders() ?? [];
});

const emits = defineEmits(['chosedWallet'])

const { initPrivyIframe } = usePrivyIframe();

async function onSelectWalletMeta(wallet: any) {
  setActiveProviderDetail(wallet);
  emits('chosedWallet')
}

async function connectMetaMask() {
  setMetaMaskSDK();
  emits('chosedWallet')
}

onMounted(async () => {
  try {
    await initPrivyIframe();
    initedPrivy.value = true;
  } catch (error) {
    console.error('Error initializing privy embedded wallet:', error);
  }
});
</script>

<template>
  <div class="px-1 flex flex-col gap-y-2">
      <div class="flex justify-between items-center">
        <span class="text-h2 text-grey-normal-hover">{{$t('loginView.choseWallet')}}</span>
        <img class="cursor-pointer" src="~@/assets/icons/icon-modal-close.svg" alt=""
             @click="modalStore.setModalVisible(false)"/>
      </div>
      <div id="wallets-container" class="flex flex-col gap-2 pt-4 pb-6">
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

        <button
            class="w-full border-[1px] border-grey-light-active shadow-shadow12 px-5 py-1 h-12 rounded-full
                   flex justify-center items-center gap-10px
                   hover:border-orange-normal hover:bg-gradient-primary hover:text-white"
            v-if="providers.length <= 1"
            :disabled="loading"
            @click="connectMetaMask()"
        >
          <img class="h-full" src="https://docs.metamask.io/img/metamask-logo.svg" alt="" />
          <!-- <span class="min-w-[100px] ml-3 text-center flex justify-center items-center gap-1 text-lg font-semibold">
            MetaMask
          </span> -->
        </button>
        <button v-if="initedPrivy" class="w-full border-[1px] border-grey-light-active shadow-shadow12 px-5 py-1 h-12 rounded-full
                   flex justify-center items-center gap-10px
                   hover:border-orange-normal hover:bg-gradient-primary hover:text-white"
                   @click="store.loginWithTwitter()">
          使用推特登录
        </button>
      </div>
    </div>
  </template>
