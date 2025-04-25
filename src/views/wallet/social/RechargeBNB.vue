<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { handleError, onMounted, ref } from "vue";
import { getSettledTokens, getTokenByTickOrCA, setNewToken } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { ethers } from "ethers";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { GlobalModalType } from "@/types";
import { useModalStore } from "@/stores/common";
import { useAccount } from "@/composables/useAccount";
import { approveCoinPurse, setTokenLimit } from "@/utils/twitterTip";
import { WETH } from "@/config";
import { sleep } from "@/utils/helper";

const socialAccountModalStore = useSocialAccountModalStore()
const tick = ref('')
const showTickerError = ref(false)
const allowance = ref<number | null>(null)
const showInputAllowance = ref(false)
const transactionLimit = ref<number | null>(null)
const showInputTransactionLimit = ref(false)
const dailyLimit = ref<number | null>(null)
const showInputDailyLimit = ref(false)
const state = ref(0)
const accStore = useAccountStore()
const modalStore = useModalStore()
const loading = ref(false)
const { accountMismatch, updateBalance } = useAccount()

const emit = defineEmits(['added'])

async function confirm() {
    try {
        loading.value = true
        showTickerError.value = false
        showInputAllowance.value = false
        showInputTransactionLimit.value = false
        showInputDailyLimit.value = false

        if (!useAccount().checkoutAccessToken()) {
            modalStore.setModalVisible(true, GlobalModalType.Login)
            return;
        }
        // check wallet connect
        if (accStore.ethConnectState !== EthWalletState.Connected) {
            modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
            return;
        }

        if (!allowance.value || allowance.value <= 0) {
            showInputAllowance.value = true
            state.value = 0
            return
        }
        if (!transactionLimit.value || transactionLimit.value < 0.0005) {
            showInputTransactionLimit.value = true
            state.value = 0
            return
        }
        if (!dailyLimit.value || dailyLimit.value < 0.0005) {
            showInputDailyLimit.value = true
            state.value = 0
            return
        }
        

        await setTokenLimit(ethers.ZeroAddress, ethers.parseEther(transactionLimit.value!.toString()), ethers.parseEther(dailyLimit.value!.toString()), ethers.parseEther(allowance.value!.toString()))

        emit('added');
        socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)
    } catch (error) {
        handleErrorTip(error)
    } finally {
        loading.value = false
    }
}

onMounted(async () => {
    let count = 0
    while(count++ < 10) {
        transactionLimit.value = accStore.transactionLimit
        dailyLimit.value = accStore.dailyLimit
        await sleep(0.2)
        if (accStore.transactionLimit > 0) {
            break
        }
    }
})

</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('profileView.recharge') }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('profileView.inputBNB')}}:
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.addTokenBnb') }}</div>
                </div>
              </template>
            </el-popover>
        </label>
        <input class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="allowance" type="number" :placeholder="$t('profileView.inputBNB')"/>
        <span class="text-red-500 text-sm" v-if="showInputAllowance">{{$t('profileView.inputBNB')}}</span>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('profileView.inputTransactionLimit')}}:
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.addToken3') }}</div>
                </div>
              </template>
            </el-popover>
        </label>
        <input class="border-[1px] mb-3 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="transactionLimit" type="number" :placeholder="$t('profileView.inputTransactionLimitPlaceholder')"/>
        <span class="text-red-500 text-sm mb-2" v-if="showInputTransactionLimit">{{$t('profileView.tipError9')}}</span>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('profileView.inputDailyLimit')}}:
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.addToken4') }}</div>
                </div>
              </template>
            </el-popover>
        </label>
        <input class="border-[1px] mb-3 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="dailyLimit" type="number" :placeholder="$t('profileView.inputDailyLimitPlaceholder')"/>
        <span class="text-red-500 text-sm" v-if="showInputDailyLimit">{{$t('profileView.tipError10')}}</span>
      </div>
      <button @click="confirm" class="h-12 w-full flex flex-row items-center justify-center gap-2 bg-orange-normal rounded-full text-white text-h5 mt-5" :disabled="loading || accountMismatch">
        {{ accStore.ethConnectAddress ? $t('confirm') : $t('connect')}}
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
      <div v-if="accountMismatch" class="text-red-500 text-sm mt-2">
        {{ $t('web3.addressMismatch', {address: accStore.getAccountInfo.ethAddr}) }}
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>