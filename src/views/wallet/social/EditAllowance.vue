<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { ref } from "vue";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { approveCoinPurse } from "@/utils/twitterTip";
import { ethers } from "ethers";
import { useAccount } from "@/composables/useAccount";
// 
const socialAccountModalStore = useSocialAccountModalStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const loading = ref(false)
const newAllowance = ref()
const emit = defineEmits(['added'])
const { accountMismatch } = useAccount()
async function confirm() {
  try {
     // check wallet connect
     if (accStore.ethConnectState !== EthWalletState.Connected) {
        modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
        return;
    }
    if (!newAllowance.value && newAllowance.value != 0) {
      handleErrorTip('Please input the new allowance')
      return
    }
    loading.value = true;
    await approveCoinPurse(socialAccountModalStore.editTokenInfo!.token, ethers.parseEther(newAllowance.value.toString()))
    emit('added')
    socialAccountModalStore.setModalVisible(false, SocialAccountModalType.EditAllowance)
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
      <span class="text-h2 text-grey-normal-hover">Update {{ socialAccountModalStore.editTokenInfo?.tick }} allowance</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.EditAllowance)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-1">
        <label for="docs" class="leading-6 text-lg">{{$t('profileView.inputAllowance')}}:</label>
        <input class="border-[1px] mt-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center"
               v-model="newAllowance" type="number" :placeholder="$t('profileView.inputAllowancePlaceholder')"/>
      </div>
      <button @click="confirm" 
        class="h-12 w-full flex items-center justify-center gap-2 bg-orange-normal rounded-full text-white text-h5 mt-5"
        :disabled="loading || accountMismatch"
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
