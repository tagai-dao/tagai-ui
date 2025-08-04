<script setup lang="ts">
import { SocialAccountModalType, useSocialAccountModalStore } from "@/stores/wallet";
import { handleError, onMounted, ref } from "vue";
import { getPendingClaimTokens, claimTokens, getClaimTipTokenSignature } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { GlobalModalType, type PendingClaimToken } from "@/types";
import { useModalStore } from "@/stores/common";
import { formatAmount } from "@/utils/helper";
import { useAccount } from "@/composables/useAccount";
import { getRewardsClaimd, 
    getPendingClaimTokens as getPendingClaimTokensOnChain,
    claimTokens as claimTokensOnChain
} from "@/utils/twitterTip";
import { zeroAddress } from "viem";

const socialAccountModalStore = useSocialAccountModalStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const loading = ref(false)
const tokens = ref<PendingClaimToken[]>([])
const emit = defineEmits(['claimed'])
const { accountMismatch, updateBalance } = useAccount();

async function claim() {
    if (accStore.ethConnectState != EthWalletState.Connected) {
        modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
        return;
    }
    try {
        const signature: any = await getClaimTipTokenSignature(accStore.getAccountInfo.twitterId)
        const tx = await claimTokensOnChain(accStore.getAccountInfo.twitterId, signature.claimTokens, signature.signature)
        await claimTokens(accStore.getAccountInfo.twitterId)
        emit('claimed')
        socialAccountModalStore.setModalVisible(false, SocialAccountModalType.ClaimTipToken)
    } catch (error) {
        handleErrorTip(error)
    } finally {
        loading.value = false
    }
}

onMounted(async () => {
  getRewardsClaimd(accStore.getAccountInfo.twitterId).then((res:any) => {
    socialAccountModalStore.needClaim = res == zeroAddress;
  })
  tokens.value = await getPendingClaimTokens(accStore.getAccountInfo.twitterId) as PendingClaimToken[]

  if (tokens.value && tokens.value.length > 0) {
    const claimTokens = await getPendingClaimTokensOnChain(accStore.getAccountInfo.twitterId, tokens.value.map((item:any) => item.token))
    tokens.value.forEach((token, index) => {
      token.amount = claimTokens[token.token]
    })
  }
})

</script>

<template>
  <div class="py-2">
    <div class="flex justify-between items-center">
      <span class="text-h2 text-grey-normal-hover">{{ $t('profileView.claimToken') }}</span>
      <img class="cursor-pointer"
           @click="socialAccountModalStore.setModalVisible(false, SocialAccountModalType.AddToken)"
           src="../../../assets/icons/icon-modal-close.svg" alt=""/>
    </div>
    <div>
        {{ $t('profileView.claimTokenDesc') }}
    </div>
    <div class="py-3">
      <div class="flex flex-col gap-1">
        <div v-for="token in tokens" :key="token.token" class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img class="w-8 h-8 rounded-full" :src="token.logo" :alt="token.tick">
            <span class="text-h4">{{ token.tick }}</span>
          </div>
          <span class="text-h4">{{ formatAmount(token.amount) }}</span>
        </div>
      </div>
      <button @click="claim" class="h-12 w-full flex flex-row items-center justify-center gap-2 bg-orange-normal rounded-full text-white text-h5 mt-5" 
        :disabled="loading || accountMismatch">
        {{ accStore.ethConnectAddress ? $t('confirm') : $t('connect')}}
        <i-ep-loading v-if="loading" class="animate-spin" />
      </button>
      <div v-if="accountMismatch">
        <span class="text-red-500 text-sm">{{ $t('web3.addressMismatch', {address: accStore.getAccountInfo.ethAddr}) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>