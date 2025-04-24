<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { ref } from "vue";
import { useAccountStore, EthWalletState } from "@/stores/web3";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { setTokenLimit } from "@/utils/twitterTip";
import { ethers } from "ethers";
import { useAccount } from "@/composables/useAccount";
const socialAccountModalStore = useSocialAccountModalStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const transLimit = ref(0)
const dayLimit = ref(0)
const loading = ref(false)
const emit = defineEmits(['added'])
const { accountMismatch } = useAccount()

async function confirm() {
  try {
      // check wallet connect
      if (accStore.ethConnectState !== EthWalletState.Connected) {
        modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
        return;
      }
      loading.value = true
      await setTokenLimit(socialAccountModalStore.editTokenInfo!.token, ethers.parseEther(transLimit.value.toString()), ethers.parseEther(dayLimit.value.toString()))
      emit('added')
      socialAccountModalStore.setModalVisible(false, SocialAccountModalType.EditLimit)
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ socialAccountModalStore.editTokenInfo?.tick }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-2">
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
        <div class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input class="flex-1 text-h3"
                 v-model="transLimit" type="number"/>
        </div>
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
        <div class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input class="flex-1 text-h3"
                 v-model="dayLimit" type="number"/>
        </div>
      </div>
      <button class="h-12 w-full bg-orange-normal rounded-full flex gap-2 items-center justify-center text-white text-h5 mt-5"
        :disabled="loading || accountMismatch"
        @click="confirm"
      >
        {{ accStore.ethConnectState == EthWalletState.Connected ? $t('confirm') : $t('connect')}}
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
