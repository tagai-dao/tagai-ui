<script setup lang="ts">
import { ref, computed } from 'vue';
import { useModalStore } from "@/stores/common";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { handleErrorTip, notify } from "@/utils/notify";
import { formatAmount } from "@/utils/helper";
import { wrapBNB, unwrapBNB } from "@/utils/twitterTip";
import { useSocialAccountModalStore } from '@/stores/wallet';
import { GlobalModalType } from '@/types';
import i18n from "@/lang";
import { useAccount } from '@/composables/useAccount';
import { parseEther } from 'viem';
const t = i18n.global.t;

const modalStore = useModalStore();
const accStore = useAccountStore();
const socialAccountModalStore = useSocialAccountModalStore()
const { updateBalance, accountMismatch } = useAccount();
// 状态变量
const loading = ref(false);
const bnbAmount = ref('');
const isWrap = ref(true); // true: BNB -> WBNB, false: WBNB -> BNB

const onSwitch = () => {
  isWrap.value = !isWrap.value;
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
    const amountBigInt = parseEther(bnbAmount.value.toString());
    if (isWrap.value) {
      await wrapBNB(amountBigInt);
    } else {
      await unwrapBNB(amountBigInt);
    }
    updateBalance();
    notify({ message: isWrap.value ? t('profileView.wrapSuccess') : t('profileView.unwrapSuccess'), type: 'success' });
    modalStore.setModalVisible(false);
  } catch (e) {
    handleErrorTip(e);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col p-6">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ isWrap ? 'Wrap BNB' : 'Unwrap WBNB' }}</span>
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
            :placeholder="`${isWrap ? $t('profileView.inputBNB') : $t('profileView.inputWBNB')}`"
          />
        </div>
        <div class="flex justify-end text-grey-normal text-sm">
          {{ $t('balance') }}: {{ formatAmount(isWrap ? accStore.ethBalance : accStore.socialBalance) }} {{ isWrap ? 'BNB' : 'WBNB' }}
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
          {{ $t('balance') }}: {{ formatAmount(isWrap ? accStore.socialBalance : accStore.ethBalance) }} {{ isWrap ? 'WBNB' : 'BNB' }}
        </div>
      </div>

      <!-- 转换按钮 -->
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="onConvert"
        :disabled="loading || !bnbAmount || accountMismatch"
      >
        <span>{{ accStore.ethConnectState === EthWalletState.Connected ? (isWrap ? 'Wrap BNB' : 'Unwrap WBNB') : $t('connect') }}</span>
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
      <div v-if="accountMismatch" class="text-red-500 text-sm mt-2">
        {{ $t('web3.addressMismatch', {address: accStore.getAccountInfo.ethAddr}) }}
      </div>
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