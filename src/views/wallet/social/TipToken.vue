<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { ref, watch } from "vue";
import { useAccountStore, EthWalletState } from "@/stores/web3";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { setTokenLimit } from "@/utils/twitterTip";
import { ethers } from "ethers";

const socialAccountModalStore = useSocialAccountModalStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const amount = ref<number|null>(null)
const to = ref<string|null>(null)
const loading = ref(false)
const showInvalidAllowance = ref(false)
const showInvalidTransLimit = ref(false)
const showInvalidDayLimit = ref(false)
const showInsufficientBalance = ref(false)

watch(amount, () => {
    checkTipError()
})

async function confirm() {
  try {
      // check wallet connect
      loading.value = true   
      if (!checkTipError()) {
        return;
      }
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`@TagAITIP tip ${amount.value} $${socialAccountModalStore.editTokenInfo?.tick} to @${to.value}`)}`, '_blank')
      socialAccountModalStore.setModalVisible(false, SocialAccountModalType.TipToken)
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false
  }
}

function checkTipError() {
    resetTipError()
    const token = socialAccountModalStore.editTokenInfo;
    if (!token) {
        return;
    }
    if (!amount.value) {
        return;
    }
    if (token.allowance < amount.value) {
        showInvalidAllowance.value = true
        return false
    }
    if (token.maxPerTx < amount.value) {
        showInvalidTransLimit.value = true
        return false
    }
    if (token.maxPerDay < amount.value) {
        showInvalidDayLimit.value = true
        return false
    }
    if (token.balance < amount.value) {
        showInsufficientBalance.value = true
        return false
    }

    return true
}

function resetTipError() {
    showInvalidAllowance.value = false
    showInvalidTransLimit.value = false
    showInvalidDayLimit.value = false
    showInsufficientBalance.value = false
}
</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('tip')  + ' ' + socialAccountModalStore.editTokenInfo?.tick }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.TipToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-2">
        <label for="docs" class="leading-6 text-lg flex gap-2">{{$t('amount')}}:
        </label>
        <div class="border-[1px] border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input class="flex-1 text-h3"
                 v-model="amount" type="number" :placeholder="$t('amount')"/>
          <span class="text-h3">${{ socialAccountModalStore.editTokenInfo?.tick }}</span>
        </div>
        <div class="text-red-500 text-sm mb-3">
            <span v-if="showInvalidAllowance">{{ $t('profileView.tipError1') }}</span>
            <span v-else-if="showInvalidTransLimit">{{ $t('profileView.tipError2') }}</span>
            <span v-else-if="showInvalidDayLimit">{{ $t('profileView.tipError3') }}</span>
            <span v-else-if="showInsufficientBalance">{{ $t('profileView.tipError4') }}</span>
        </div>
        <label for="docs" class="leading-6 text-lg flex gap-2">To:
        </label>
        <div class="border-[1px] mb-5 border-grey-c9 rounded-xl px-4 h-12 web:h-11 gap-4 text-black flex items-center">
          <input class="flex-1 text-h3"
                 v-model="to" type="text" :placeholder="$t('profileView.toTwitterUsername')"/>
        </div>
      </div>
      <button class="h-12 w-full bg-orange-normal rounded-full flex gap-2 items-center justify-center text-white text-h5 mt-5"
        @click="confirm"
        :disabled="!checkTipError()"
      >
        {{ $t('confirm')}}
      </button>
    </div>
  </div>
</template>

<style scoped>

</style>
