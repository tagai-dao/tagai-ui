<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { GlobalModalType, type Community } from "@/types";
import { isAddress, checksumAddress, parseEther } from "viem";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useI18n } from "vue-i18n";
import { formatBalance } from "@/utils/helper";
import { getTokenBalance } from "@/utils/web3";
import { transferToken } from "@/utils/pump";
import { handleErrorTip } from '@/utils/notify';
import { useAccount } from "@/composables/useAccount";
import { useModalStore } from "@/stores/common";

const { t } = useI18n()

// 定义组件属性
interface Props {
  community: Community; // 代币符号
  balance: bigint;
}

const modalStore = useModalStore()
const props = defineProps<Props>()
const accStore = useAccountStore()
const tokenBalance = ref(0n);
const isMax = ref(false);
const { accountMismatch } = useAccount();

const emit = defineEmits(['close']);

// 表单数据
const transferForm = ref({
  toAddress: '', // 转账目标地址
  amount: '', // 转账数量
});

// 表单验证状态
const formErrors = ref({
  toAddress: '',
  amount: '',
  general: ''
});

// 转账状态
const isTransferring = ref(false);

// 计算属性：验证表单是否有效
const isFormValid = computed(() => {
  return isAddress(transferForm.value.toAddress.trim()) && 
         transferForm.value.amount && 
         !formErrors.value.toAddress && 
         !formErrors.value.amount &&
         accountMismatch;
});

// 验证转账数量
const validateAmount = (amount: string) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return t('web3.inputAmount');
  }
  
  // 检查余额是否足够
  if (parseEther(amount.toString()) > tokenBalance.value) {
    return t('profileView.tipError4');
  }
  
  return '';
};

// 处理地址输入
const onAddressInput = () => {
  formErrors.value.toAddress = isAddress(transferForm.value.toAddress as `0x${string}`) ? '' : 'Invalid address';
  formErrors.value.general = '';
};

// 处理数量输入
const onAmountInput = () => {
  isMax.value = false;
  formErrors.value.amount = validateAmount(transferForm.value.amount);
  formErrors.value.general = '';
};

// 使用最大余额
const useMaxBalance = () => {
  // @ts-ignore
  transferForm.value.amount = (tokenBalance.value.toString() / 1e18).toString();
  formErrors.value.amount = '';
  isMax.value = true;
};

// 确认转账
const confirmTransfer = async () => {
  if (accStore.ethConnectState != EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  // 最终验证
  const addressError = isAddress(transferForm.value.toAddress as `0x${string}`) ? '' : 'Invalid address';
  const amountError = validateAmount(transferForm.value.amount);
  
  if (addressError || amountError) {
    formErrors.value.toAddress = addressError;
    formErrors.value.amount = amountError;
    return;
  }
  
  try {
    isTransferring.value = true;
    const hash = await transferToken(props.community.token as `0x${string}`, transferForm.value.toAddress as `0x${string}`, parseEther(transferForm.value.amount.toString()), isMax.value);
    // const balance = await getTokenBalance(props.community.token as `0x${string}`);
    // tokenBalance.value = balance;
    emit('close', true);
  } catch (error) {
    handleErrorTip(error);
  } finally {
    isTransferring.value = false;
  }
};

onMounted(async () => {
  tokenBalance.value = props.balance;
  // get token balance
  const balance = await getTokenBalance(props.community.token as `0x${string}`);
  tokenBalance.value = balance;
})
</script>

<template>
  <div class="flex flex-col gap-y-2 max-h-[70vh] overflow-auto no-scroll-bar">
    <!-- 标题栏 -->
    <div class="flex justify-between items-center my-3">
      <span class="text-h2 text-grey-normal-hover">{{ $t('web3.transfer') }}</span>
      <i-ep-close class="text-grey-normal-hover" @click="emit('close')" />
    </div>
    <!-- 代币信息 -->
    <div class="bg-grey-f0/50 rounded-lg p-3 mb-2">
      <div class="flex items-center gap-3 mb-2">
        <img 
          v-if="community.logo" 
          :src="community.logo" 
          class="w-8 h-8 rounded-full"
          alt="Logo"
        />
        <div class="flex-1">
          <div class="text-lg font-medium text-black">{{ community.tick }}</div>
          <div class="text-sm text-grey-normal">{{ $t('web3.availableBalance') }}: {{ formatBalance((tokenBalance.toString() as any) / 1e18) }} {{ community.tick }}</div>
        </div>
      </div>
    </div>

    <!-- 转账表单 -->
    <div class="flex flex-col gap-4">
      <!-- 转账地址 -->
      <div class="flex flex-col gap-1">
        <label for="toAddress" class="leading-6 text-lg font-medium text-black">
          To:
        </label>
        <input
          id="toAddress"
          v-model="transferForm.toAddress"
          @input="onAddressInput"
          @blur="onAddressInput"
          class="border-b-[1px] border-grey-e6 leading-6 text-base"
          type="text"
          :placeholder="$t('web3.inputAddress')"
        />
        <div v-if="formErrors.toAddress" class="text-red-e6 text-sm">
          {{ formErrors.toAddress }}
        </div>
      </div>

      <!-- 转账数量 -->
      <div class="flex flex-col gap-1">
        <label for="amount" class="leading-6 text-lg font-medium text-black">
          Amount:
        </label>
        <div class="flex items-center border-b-[1px] border-grey-e6 gap-2 h-14">
          <input
            id="amount"
            v-model="transferForm.amount"
            @input="onAmountInput"
            @blur="onAmountInput"
            class="flex-1 leading-6 text-base"
            type="number"
            :min="0"
            :max="((balance as any) / 1e18).toString()"
            :placeholder="$t('web3.inputAmount')"
          />
          <span class="italic text-red-e6">{{ community.tick }}</span>
          <button
            @click="useMaxBalance"
            type="button"
            class="px-3 py-1 text-sm border border-orange-light-active rounded-md text-orange-light-active hover:bg-orange-light-active hover:text-white transition-colors"
          >
            {{ $t('max') }}
          </button>
        </div>
        <div v-if="formErrors.amount" class="text-red-e6 text-sm">
          {{ formErrors.amount }}
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="formErrors.general" class="text-red-e6 text-sm text-center">
      {{ formErrors.general }}
    </div>

    <!-- 操作按钮 -->
    <div class="py-2">
      
      <button
        class="h-12 w-full bg-gradient-primary text-white font-bold rounded-full text-lg flex items-center justify-center gap-2 disabled:opacity-30"
        @click="confirmTransfer"
        :disabled="!isFormValid || isTransferring"
      >
        <span>{{ $t('confirm') }}</span>
        <i-ep-loading v-if="isTransferring" class="animate-spin" />
      </button>
      <span v-if="accountMismatch" class="text-red-e6 text-sm text-center">
        {{ $t('web3.addressMismatch', {address: useAccountStore().getAccountInfo.ethAddr}) }}
      </span>
    </div>

    <!-- 安全提示 -->
    <div class="text-left text-grey-normal text-sm px-3">
      <p class="mb-1">⚠️ {{ $t('web3.transferTip1') }}</p>
      <p>⚠️ {{ $t('web3.transferTip2') }}</p>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.no-scroll-bar::-webkit-scrollbar {
  display: none;
}

.no-scroll-bar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
