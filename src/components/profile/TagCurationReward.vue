<script setup lang="ts">
import { useAccount } from '@/composables/useAccount';
import { useModalStore } from '@/stores/common';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { GlobalModalType, type CurationReward } from '@/types';
import { formatAmount, formatPrice, sleep } from '@/utils/helper';
import { handleErrorTip } from '@/utils/notify';
import { getClaimSignature, setOrderClaimed } from '@/apis/api'
import { claimReward } from '@/utils/pump'
import { ref } from 'vue'
import emitter from '@/utils/emitter';
import { ethers } from 'ethers';

const props = defineProps<{reward: CurationReward}>()
const claiming = ref(false)
const accStore = useAccountStore()
const modalStore = useModalStore()

const { accountMismatch } = useAccount();

async function claim() {
  if (accStore.ethConnectState != EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  try{
    claiming.value = true
    const res: any = await getClaimSignature(accStore.getAccountInfo.twitterId, props.reward.tick)
    if (res) {
      const {signature, orderId, amount} = res;
      const hash = await claimReward(props.reward.token, BigInt(orderId), ethers.parseEther(amount.toString()), signature);
      setOrderClaimed(accStore.getAccountInfo.twitterId, orderId, hash).catch(console.error);
      await sleep(1)
      emitter.emit('claimedReward')
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    claiming.value = false
  }
}
</script>

<template>
  <div class="bg-white px-4 py-5 rounded-xl w-[260px]">
    <div class="flex items-center gap-2">
      <img class="w-8 h-8 min-w-8 rounded-full"
           :src="reward.logo" alt="">
      <div class="flex flex-col gap-2">
        <div class="text-h3">#{{ reward.tick }}</div>
        <div class="text-h5">{{ formatAmount(reward.amount) }} ({{ formatPrice(reward.amount * reward.price) }})</div>
      </div>
    </div>
    <button @click="claim" :disabled="claiming"
     class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4">
      Claim
      <i-ep-loading v-if="claiming" class="animate-spin" />
    </button>
    <div v-if="accountMismatch && accStore.ethConnectState == EthWalletState.Connected"
         class="text-red-e6 w-full text-sm break-words">
      {{ $t('web3.addressMismatch', {address: accStore.getAccountInfo.ethAddr}) }}
    </div>
  </div>
</template>

<style scoped>

</style>
