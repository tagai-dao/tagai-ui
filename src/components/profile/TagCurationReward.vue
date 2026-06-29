<script setup lang="ts">
import { useAccount } from '@/composables/useAccount';
import { useModalStore } from '@/stores/common';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { GlobalModalType, type CurationReward } from '@/types';
import { formatAmount, formatPrice, parseEtherAmount, sleep } from '@/utils/helper';
import { handleErrorTip, notify } from '@/utils/notify';
import { getClaimSignature, setOrderClaimed, getCommunityDetail } from '@/apis/api'
import { claimReward, claimRewardV8 } from '@/utils/pump'
import { usesNutboxSocialPool, normalizePumpVersion } from '@/utils/pumpVersion'
import { ref } from 'vue'
import emitter from '@/utils/emitter';
import { ClaimFee } from '@/config';
import { isAddress } from 'viem';
import errCode from '@/errCode';
import { useRouter } from 'vue-router';
import CommunityLogo from '@/components/common/CommunityLogo.vue';
import { getReadOnlyClient } from '@/utils/wallets';
import { useI18n } from 'vue-i18n';

const CLAIM_GAS_RESERVE_BNB = 0.00015

const props = defineProps<{reward: CurationReward, canClaim: Boolean, isProfile: Boolean}>()
const claiming = ref(false)
const accStore = useAccountStore()
const modalStore = useModalStore()
const router = useRouter()
const { t } = useI18n()

const { accountMismatch, updateBalance } = useAccount();

async function getConnectedBnbBalance(): Promise<number> {
  const addr = accStore.ethConnectAddress
  if (!addr || !isAddress(addr)) return 0
  try {
    const wei = await getReadOnlyClient().getBalance({ address: addr as `0x${string}` })
    return Number(wei) / 1e18
  } catch {
    return accStore.ethBalance ?? 0
  }
}

function isClaimedRevert(e: unknown): boolean {
  const msg = JSON.stringify(e) + String((e as { message?: string; shortMessage?: string })?.message || '')
    + String((e as { shortMessage?: string })?.shortMessage || '')
  return msg.includes('Claimed')
}

async function resolveSocialPoolForClaim(
  token: string,
  version: number,
  fromApi?: string,
  fromReward?: string,
): Promise<string | undefined> {
  if (fromApi && isAddress(fromApi)) return fromApi
  if (fromReward && isAddress(fromReward)) return fromReward
  if (version !== 10) return undefined
  try {
    const detail: any = await getCommunityDetail(props.reward.tick)
    const pool = detail?.socialPoolAddress
    return pool && isAddress(pool) ? pool : undefined
  } catch (e) {
    console.warn('resolveSocialPoolForClaim failed', e)
    return undefined
  }
}

async function claim() {
  if (accStore.ethConnectState != EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }

  if (accountMismatch.value && accStore.getAccountInfo?.walletType === 0 && isAddress(accStore.getAccountInfo?.ethAddr ?? '')) {
    return;
  }
  if (accStore.getAccountInfo.walletType === 1 && accStore.getAccountInfo?.ethAddr != accStore.ethConnectAddress) {
    await useAccount().bondEthAddress()
    return;
  }
  
  // 领取走当前连接钱包，需检查连接地址 BNB（含 ClaimFee + gas 预留）
  const claimFeeBnb = Number(ClaimFee) / 1e18
  const connectedBnb = await getConnectedBnbBalance()
  if (connectedBnb < claimFeeBnb + CLAIM_GAS_RESERVE_BNB) {
    notify({ message: t('errMessage.insufficientBalance') })
    return
  }
  let lastOrderId: string | undefined
  try {
    claiming.value = true
    const rewardVersion = normalizePumpVersion(props.reward.version)
    const res: any = await getClaimSignature(accStore.getAccountInfo.twitterId, props.reward.tick)
    if (!res || res.error) {
      console.warn('getClaimSignature empty or error', res)
      return
    }
    const { signature, orderId, amount, deadline, socialPoolAddress: apiPool } = res
    lastOrderId = String(orderId)
    if (usesNutboxSocialPool(rewardVersion)) {
      if (deadline == null) {
        console.warn('claim signature missing deadline', res)
        notify({ message: t('errMessage.paramsError'), type: 'error' })
        return
      }
      const socialPoolAddress = await resolveSocialPoolForClaim(
        props.reward.token,
        rewardVersion,
        apiPool,
        props.reward.socialPoolAddress,
      )
      if (rewardVersion === 10 && !socialPoolAddress) {
        console.warn('v10 claim missing socialPoolAddress', props.reward.tick)
        notify({ message: t('errMessage.paramsError'), type: 'error' })
        return
      }
      const hash = await claimRewardV8(
        props.reward.token,
        BigInt(orderId),
        parseEtherAmount(amount),
        BigInt(deadline),
        signature,
        rewardVersion,
        socialPoolAddress,
      )
      setOrderClaimed(accStore.getAccountInfo.twitterId, orderId, hash, rewardVersion).catch(console.error)
      await sleep(1)
      emitter.emit('claimedReward')
      return
    }
    const hash = await claimReward(props.reward.token, rewardVersion || 2, BigInt(orderId), parseEtherAmount(amount), signature)
    setOrderClaimed(accStore.getAccountInfo.twitterId, orderId, hash, rewardVersion || 2).catch(console.error)
    await sleep(1)
    emitter.emit('claimedReward')
  } catch (e) {
    console.log(53, e)
    if (isClaimedRevert(e) && lastOrderId) {
      // 链上已领取但 DB 未同步：通知后端按用户地址校验并落库
      await setOrderClaimed(
        accStore.getAccountInfo.twitterId,
        lastOrderId,
        'on-chain-verified',
        normalizePumpVersion(props.reward.version) || 8,
      ).catch(console.error)
      notify({ message: t('errMessage.noRewardToClaim'), type: 'info' })
      emitter.emit('claimedReward')
      return
    }
    handleErrorTip(e)
    if (e === errCode.NO_REWARD_TO_CLAIM) {
      emitter.emit('claimedReward')
    }
  } finally {
    claiming.value = false
    updateBalance()
  }
}

function login() {
  if (accStore.getAccountInfo?.twitterId) {
    router.push('/profile')
  } else {
    modalStore.setModalVisible(true, GlobalModalType.Login)
  }
}
</script>

<template>
  <div class="bg-white px-4 py-5 rounded-xl card w-[260px]">
    <div class="flex items-center gap-2">
      <CommunityLogo :logo="reward.logo" size="xs" />
      <div class="flex flex-col gap-2">
        <div class="text-h3">#{{ reward.tick }}</div>
        <div class="text-h5">{{ formatAmount(reward.amount) }} ({{ formatPrice(reward.amount * reward.price) }})</div>
      </div>
    </div>
    
    <button v-if="isProfile" @click="claim" :disabled="claiming || !canClaim || accStore.ethConnectState == EthWalletState.Connecting"
     class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4">
      {{ canClaim ? $t('claim') : $t('pendingSettled') }}
      <i-ep-loading v-if="claiming || (canClaim && accStore.ethConnectState == EthWalletState.Connecting)" class="animate-spin" />
    </button>
    <button v-else @click="login"
     class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4">
      {{ $t('claim') }}
    </button>
    <div v-if="isProfile && accountMismatch && accStore.ethConnectState == EthWalletState.Connected"
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
