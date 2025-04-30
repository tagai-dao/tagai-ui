<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useModalStore, useStateStore } from "@/stores/common";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { handleErrorTip, notify } from "@/utils/notify";
import { formatAmount } from "@/utils/helper";
import { wrapBNB, unwrapBNB } from "@/utils/twitterTip";
import { useSocialAccountModalStore } from '@/stores/wallet';
import { GlobalModalType } from '@/types';
import i18n from "@/lang";
import { ethers } from 'ethers';
import { useAccount } from '@/composables/useAccount';
import { getIPShareBalance } from '@/utils/ipshare';
const t = i18n.global.t;

const modalStore = useModalStore();
const accStore = useAccountStore();
const socialAccountModalStore = useSocialAccountModalStore()
const stateStore = useStateStore();
const { updateBalance, accountMismatch } = useAccount();
const ipshareBalance = ref(0n);
// 状态变量
const loading = ref(false);
const bnbAmount = ref('');
const isBuy = ref(true); // true: BNB -> WBNB, false: WBNB -> BNB

const onSwitch = () => {
  isBuy.value = !isBuy.value;
  bnbAmount.value = '';
};

const onConvert = async () => {
  try {
    // check wallet connect
    if (accStore.ethConnectState !== EthWalletState.Connected) {
            modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
            return;
        }
    loading.value = true;
    const amountBigInt = ethers.parseEther(bnbAmount.value.toString());
    if (isBuy.value) {
      await wrapBNB(amountBigInt);
    } else {
      await unwrapBNB(amountBigInt);
    }
    updateBalance();
    notify({ message: isBuy.value ? t('profileView.wrapSuccess') : t('profileView.unwrapSuccess'), type: 'success' });
    modalStore.setModalVisible(false);
  } catch (e) {
    handleErrorTip(e);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
    const balance = await getIPShareBalance(stateStore.currentSelectedIPShare ?? '');
    ipshareBalance.value = balance;
}
)
</script>

<template>
  <div class="flex flex-col p-6">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('trade') }}</span>
      <img
        class="cursor-pointer"
        @click="socialAccountModalStore.setModalVisible(false)"
        src="~@/assets/icons/icon-modal-close.svg"
        alt=""
      />
    </div>

    <div class="flex flex-col gap-4">
      <!-- BNB输入框 -->
      <div class="flex flex-col gap-1 mt-5">
        <div class="border-[1px] border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input
            class="flex-1 leading-6 text-base"
            v-model="bnbAmount"
            type="number"
            :placeholder="`${isBuy ? $t('profileView.inputBNB') : $t('profileView.inputWBNB')}`"
          />
        </div>
        <div class="flex justify-end text-grey-normal text-sm">
          {{ $t('balance') }}: {{ formatAmount(isBuy ? accStore.ethBalance : (ipshareBalance as any).toString() / 1e18) }} {{ isBuy ? 'BNB' : 'IPShare' }}
        </div>
      </div>

      <!-- 转换图标 -->
      <div class="flex justify-center">
        <button
          @click="onSwitch"
        >
          <img src="~@/assets/icons/icon-swap.svg" alt="swap" class="w-8 h-8" />
        </button>
      </div>

      <!-- WBNB显示框 -->
      <div class="flex flex-col gap-1">
        <div class="border-[1px] border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input
            class="flex-1 leading-6 text-base"
            :value="bnbAmount"
            type="number"
            disabled
          />
        </div>
        <div class="flex justify-end text-grey-normal text-sm">
          {{ $t('balance') }}: {{ formatAmount(isBuy ? ((ipshareBalance as any).toString() / 1e18) : accStore.ethBalance) }} {{ isBuy ? 'IPShare' : 'BNB' }}
        </div>
      </div>

      <!-- 转换按钮 -->
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="onConvert"
        :disabled="loading || !bnbAmount || accountMismatch"
      >
        <span>{{ accStore.ethConnectState === EthWalletState.Connected ? (isBuy ? 'Buy IPShare' : 'Sell IPShare') : $t('connect') }}</span>
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.text-gradient {
  background: linear-gradient(90deg, #FF6B00 0%, #FFA800 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>