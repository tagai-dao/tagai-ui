<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { handleError, ref } from "vue";
import { getSettledTokens, getTokenByTickOrCA, setNewToken } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { ethers } from "ethers";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { GlobalModalType } from "@/types";
import { useModalStore } from "@/stores/common";
import { useAccount } from "@/composables/useAccount";
import { approveCoinPurse, setTokenLimit } from "@/utils/twitterTip";
import { WETH } from "@/config";

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

        if (!tick.value) {
            showTickerError.value = true
            state.value = 0
            return
        }
        if (!allowance.value || allowance.value <= 0) {
            showInputAllowance.value = true
            state.value = 0
            return
        }
        if (!transactionLimit.value || transactionLimit.value <= 0) {
            showInputTransactionLimit.value = true
            state.value = 0
            return
        }
        if (!dailyLimit.value || dailyLimit.value <= 0) {
            showInputDailyLimit.value = true
            state.value = 0
            return
        }
        state.value = 1
        const res:any = await getTokenByTickOrCA(tick.value)
        if (!res?.token) {
            showTickerError.value = true
            state.value = 0
            return
        }
        state.value = 2
        await approveCoinPurse(res.token, ethers.parseEther(allowance.value!.toString()))

        state.value = 3
        await setTokenLimit(res.token, ethers.parseEther(transactionLimit.value!.toString()), ethers.parseEther(dailyLimit.value!.toString()))

        await setNewToken(accStore.getAccountInfo?.twitterId!, tick.value)

        let updatedTokens: any = await getSettledTokens(accStore.getAccountInfo.twitterId!)
        if (!updatedTokens || updatedTokens.length == 0) {
          updatedTokens = []
        }
        updatedTokens = [{
          token: WETH,
          tick: 'WBNB',
          logo: 'https://tiptag.oss-cn-shenzhen.aliyuncs.com/tagai/community/bnb-logo.svg'
        }].concat(updatedTokens)
        socialAccountModalStore.socialAccountTokens = updatedTokens
        await socialAccountModalStore.updateSocialAccountTokens()
        emit('added');
        state.value = 0
        socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)
    } catch (error) {
        state.value = 0
        handleErrorTip(error)
    } finally {
        loading.value = false
    }
}

</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('profileView.addToken') }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('profileView.inputTick')}}:
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.addToken1') }}</div>
                </div>
              </template>
            </el-popover>
        </label>
        <input class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="tick" type="text" :placeholder="$t('profileView.inputTickPlaceholder')"/>
        <span class="text-red-500 text-sm" v-if="showTickerError">{{$t('profileView.tickerError')}}</span>
      </div>
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('profileView.inputAllowance')}}:
            <el-popover popper-class="c-popper" width="300">
              <template #reference>
                <img class="w-4 min-w-4 min-h-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-3 shadow-popper-tip">
                  <div class="mb-1">{{ $t('profileView.addToken2') }}</div>
                </div>
              </template>
            </el-popover>
        </label>
        <input class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="allowance" type="number" :placeholder="$t('profileView.inputAllowancePlaceholder')"/>
        <span class="text-red-500 text-sm" v-if="showInputAllowance">{{$t('profileView.inputAllowancePlaceholder')}}</span>
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
        <input class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="transactionLimit" type="number" :placeholder="$t('profileView.inputTransactionLimitPlaceholder')"/>
        <span class="text-red-500 text-sm" v-if="showInputTransactionLimit">{{$t('profileView.inputTransactionLimitPlaceholder')}}</span>
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
        <span class="text-red-500 text-sm" v-if="showInputDailyLimit">{{$t('profileView.inputDailyLimitPlaceholder')}}</span>
      </div>
      <button @click="confirm" class="h-12 w-full flex flex-row items-center justify-center gap-2 bg-orange-normal rounded-full text-white text-h5 mt-5" :disabled="loading">
        {{ accStore.ethConnectAddress ? $t('confirm') : $t('connect')}}
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
      
      <!-- 进度条组件 -->
      <div class="mt-6">
        <div class="flex items-center justify-between mb-2">
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 1 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.newTokenStep1')}}</span>
          </div>
          <div class="flex-1 h-[2px] mx-2" :class="state >= 2 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 2 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.newTokenStep2')}}</span>
          </div>
          <div class="flex-1 h-[2px] mx-2" :class="state >= 3 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full" :class="state >= 3 ? 'bg-orange-normal' : 'bg-grey-e6'"></div>
            <span class="text-sm mt-1">{{$t('profileView.newTokenStep3')}}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>