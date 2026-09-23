<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountStore, EthWalletState } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { getTradeRewards, getTradeClaim, confirmTradeClaim, type TradeReward } from '@/utils/tradeCuration'
import { claimRewardV8 } from '@/utils/pump'
import { notify, handleErrorTip } from '@/utils/notify'
import { formatAmount } from '@/utils/helper'
import CommunityLogo from '@/components/common/CommunityLogo.vue'
const props = defineProps<{ twitterId?: string; isProfile: boolean; state: string }>()
const acc = useAccountStore(), chain = useChainStore(), { t } = useI18n()
const rewards = ref<TradeReward[]>([]), claiming = ref('')
let generation = 0
async function refresh() {
  const current = ++generation
  if (chain.activeChainId !== 56 || !props.twitterId) { rewards.value = []; return }
  try {
    const result = await getTradeRewards(props.twitterId)
    if (generation === current) rewards.value = result
  } catch { if (generation === current) rewards.value = [] }
}
watch(() => [props.twitterId, props.state, chain.activeChainId], refresh, { immediate: true })
const timer = setInterval(refresh, 30000)
onUnmounted(() => { generation++; clearInterval(timer) })
async function claim(reward: TradeReward) {
  if (claiming.value) return
  if (acc.ethConnectState !== EthWalletState.Connected) { useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet); return }
  const twitterId = props.twitterId
  if (!twitterId || twitterId !== acc.getAccountInfo?.twitterId) return
  if (acc.ethConnectAddress?.toLowerCase() !== acc.getAccountInfo.ethAddr?.toLowerCase()) {
    notify({ message: t('web3.addressMismatch', { address: acc.getAccountInfo.ethAddr }) }); return
  }
  claiming.value = reward.pool
  let orderId: string | undefined
  try {
    const order = await getTradeClaim(twitterId, reward.pool)
    orderId = order.orderId
    if (chain.activeChainId !== 56 || order.recipient.toLowerCase() !== acc.ethConnectAddress?.toLowerCase()) throw new Error('TRADE_CURATION_WALLET_CHANGED')
    await claimRewardV8(order.token, BigInt(order.orderId), BigInt(order.amountRaw), BigInt(order.deadline), order.signature, 14, order.pool)
    await confirmTradeClaim(twitterId, order.orderId)
    notify({ message: t('tradeCuration.claimSubmitted') })
    await refresh()
  } catch (e) {
    if (orderId) await confirmTradeClaim(twitterId, orderId).catch(() => {})
    handleErrorTip(e)
    await refresh()
  } finally { claiming.value = '' }
}
</script>
<template>
  <div v-if="chain.activeChainId === 56 && rewards.some(r => r.state === (state === 'Claimable' ? 'claimable' : 'processing'))" class="px-3 py-3">
    <div class="text-h3 mb-3">{{ t('tradeCuration.title') }}</div>
    <div class="flex gap-3 overflow-x-auto">
      <div v-for="reward in rewards.filter(r => r.state === (state === 'Claimable' ? 'claimable' : 'processing'))" :key="reward.pool" class="border border-orange-normal rounded-xl p-4 min-w-[240px]">
        <div class="flex items-center gap-2"><CommunityLogo :logo="reward.logo" size="xs" /><strong>#{{ reward.tick }}</strong></div>
        <div class="mt-2">{{ formatAmount(Number(reward.amount)) }}</div>
        <button v-if="isProfile" class="bg-gradient-primary text-white rounded-full w-full h-10 mt-3" :disabled="!!claiming || reward.state !== 'claimable'" @click="claim(reward)">
          {{ claiming === reward.pool ? t('tradeCuration.claiming') : reward.state === 'claimable' ? t('claim') : t('pendingSettled') }}
        </button>
      </div>
    </div>
  </div>
</template>
