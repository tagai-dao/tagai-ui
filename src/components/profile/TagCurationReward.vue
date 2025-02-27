<script setup lang="ts">
import { useAccount } from '@/composables/useAccount';
import { useModalStore } from '@/stores/common';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { GlobalModalType, type CurationReward } from '@/types';
import { formatAmount, formatPrice, sleep } from '@/utils/helper';
import { handleErrorTip, notify } from '@/utils/notify';
import { getClaimSignature, setOrderClaimed } from '@/apis/api'
import { onMounted, ref, watch } from 'vue'
import emitter from '@/utils/emitter';
import { ClaimFee } from '@/config';
import { useWallet, useAnchorWallet } from 'solana-wallets-vue';
import { Connection, Transaction } from '@solana/web3.js';
import { web3 } from '@coral-xyz/anchor';
import errCode from '@/errCode';

const props = defineProps<{reward: CurationReward, canClaim: Boolean}>()
const claiming = ref(false)
const accStore = useAccountStore()
const modalStore = useModalStore()
const { publicKey, readyState, connecting, connected, wallet, sendTransaction, signTransaction } = useWallet()
const anchorWallet = useAnchorWallet()
const { accountMismatch, updateBalance } = useAccount();

watch(publicKey, (val) => {
  console.log('connected', val)
})

async function claim() {
  if (!connected.value) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  if (publicKey.value?.toBase58() != accStore.getAccountInfo?.solAddr) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  // check eth balance
  // @ts-ignore
  if (accStore.solBalance < (ClaimFee / 1e9)) {
    notify({message: 'Insufficient Solana balance'})
    return
  }
  try{
    claiming.value = true
    const res: any = await getClaimSignature(accStore.getAccountInfo.twitterId, props.reward.tick)
    if (res) {
      let {signature, orderId, amount} = res;
      const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL!, "confirmed");
      let tx: any = Transaction.from(Buffer.from(signature, 'base64'));
      
      // tx = await signTransaction.value!(tx);
      // console.log('tx3', tx)
      tx = await sendTransaction(tx, connection, {
        // skipPreflight: true,
      });
      setOrderClaimed(accStore.getAccountInfo.twitterId, orderId, tx).catch(console.error);
      await sleep(1)
      emitter.emit('claimedReward')
    }
  } catch (e) {
    console.log(53, e)
    if (e === errCode.NO_REWARD_TO_CLAIM) {
      emitter.emit('claimedReward')
    } else {
      handleErrorTip(e)
    }
  } finally {
    claiming.value = false
    updateBalance()
  }
}

onMounted(() => {
  console.log('readyState', readyState.value, publicKey.value?.toBase58(), connected.value)
})
</script>

<template>
  <div class="bg-white px-4 py-5 rounded-xl card w-[260px]">
    <div class="flex items-center gap-2">
      <img class="w-8 h-8 min-w-8 rounded-full"
           :src="reward.logo" alt="">
      <div class="flex flex-col gap-2">
        <div class="text-h3">#{{ reward.tick }}</div>
        <div class="text-h5">{{ formatAmount(reward.amount) }} ({{ formatPrice(reward.amount * reward.price) }})</div>
      </div>
    </div>
    <button @click="claim" :disabled="claiming || !canClaim || accountMismatch"
     class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4">
      {{ canClaim ? 'Claim' : 'Pending settled' }}
      <i-ep-loading v-if="claiming" class="animate-spin" />
    </button>
    <div v-if="accountMismatch && connected"
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
