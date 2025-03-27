<script setup lang="ts">
import { useAccount } from '@/composables/useAccount';
import { useModalStore } from '@/stores/common';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { GlobalModalType, type CurationReward } from '@/types';
import { formatAmount, formatPrice, sleep } from '@/utils/helper';
import { handleErrorTip, notify } from '@/utils/notify';
import { getClaimSignature, setOrderClaimed } from '@/apis/api'
import { claimReward } from '@/utils/pump'
import { ref } from 'vue'
import emitter from '@/utils/emitter';
import { ethers } from 'ethers';
import { ClaimFee } from '@/config';
import errCode from '@/errCode';

const props = defineProps<{reward: CurationReward, canClaim: Boolean}>()
const claiming = ref(false)
const accStore = useAccountStore()
const modalStore = useModalStore()

const { accountMismatch, updateBalance } = useAccount();

async function claim() {
  if (accStore.ethConnectState != EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  // check eth balance
  // @ts-ignore
  if (accStore.ethBalance < (ClaimFee / 1e18)) {
    notify({message: 'Insufficient BNB balance'})
    return
  }
  try{
    claiming.value = true
    const res: any = await getClaimSignature(accStore.getAccountInfo.twitterId, props.reward.tick)
    if (res) {
      const {signature, orderId, amount} = res;
      const hash = await claimReward(props.reward.token, props.reward.version ?? 2, BigInt(orderId), ethers.parseEther(amount.toString()), signature);
      setOrderClaimed(accStore.getAccountInfo.twitterId, orderId, hash, props.reward.version ?? 2).catch(console.error);
      await sleep(1)
      emitter.emit('claimedReward')
    }
  } catch (e) {
    console.log(53, e)
    handleErrorTip(e)
    if (e === errCode.NO_REWARD_TO_CLAIM) {
      emitter.emit('claimedReward')
    }
  } finally {
    claiming.value = false
    updateBalance()
  }
}
</script>

<template>
  <div class="bg-white px-4 py-5 rounded-xl card w-[260px]">
    <div class="flex items-center gap-2">
      <img class="w-8 h-8 min-w-8 rounded-full"
           :src="reward.logo.startsWith('https://tiptag') ? reward.logo + '?x-oss-process=image/resize,w_100' : reward.logo" alt="">
      <div class="flex flex-col gap-2">
        <div class="text-h3">#{{ reward.tick }}</div>
        <div class="text-h5">{{ formatAmount(reward.amount) }} ({{ formatPrice(reward.amount * reward.price) }})</div>
      </div>
    </div>
    <button @click="claim" :disabled="claiming || !canClaim || accountMismatch"
     class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4">
      {{ canClaim ? $t('claim') : $t('pendingSettled') }}
      <i-ep-loading v-if="claiming" class="animate-spin" />
    </button>
    <div v-if="accountMismatch && accStore.ethConnectState == EthWalletState.Connected"
         class="text-red-e6 w-full text-sm break-words">
      {{ $t('web3.addressMismatch', {address: accStore.getAccountInfo.ethAddr}) }}
    </div>
  </div>
</template>

<style scoped>
.card{
  border: 1px solid #FF7A00;
}
</style>
