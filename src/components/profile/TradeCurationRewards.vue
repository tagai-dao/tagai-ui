<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountStore, EthWalletState } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { getTradeRewards, getTradeClaim, confirmTradeClaim, type TradeReward } from '@/utils/tradeCuration'
import { claimTradeReward } from '@/utils/tradeCurationClaim'
import { notify, handleErrorTip } from '@/utils/notify'
import { formatAmount } from '@/utils/helper'
import CommunityLogo from '@/components/common/CommunityLogo.vue'
const props = defineProps<{ twitterId?: string; isProfile: boolean; state: string }>()
const acc = useAccountStore(), chain = useChainStore(), { t } = useI18n()
const rewards = ref<TradeReward[]>([]), claiming = ref('')
let generation = 0
async function refresh() {
  const current = ++generation
  if (![56,4663].includes(chain.activeChainId) || !props.twitterId) { rewards.value = []; return }
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
  const claimChainId=chain.activeChainId
  claiming.value = reward.pool
  let orderId: string | undefined
  try {
    const order = await getTradeClaim(twitterId, reward.pool,claimChainId)
    orderId = order.orderId
    if(order.pool.toLowerCase()!==reward.pool.toLowerCase() || order.token.toLowerCase()!==reward.token.toLowerCase()) throw new Error('POOL_CONFIGURATION_MISMATCH')
    if (chain.activeChainId!==claimChainId || order.recipient.toLowerCase() !== acc.ethConnectAddress?.toLowerCase()) throw new Error('TRADE_CURATION_WALLET_CHANGED')
    await claimTradeReward(order,claimChainId)
    await confirmTradeClaim(twitterId, order.orderId,claimChainId)
    notify({ message: t('tradeCuration.claimSubmitted') })
    await refresh()
  } catch (e) {
    if (orderId) await confirmTradeClaim(twitterId, orderId,claimChainId).catch(() => {})
    handleErrorTip(e)
    await refresh()
  } finally { claiming.value = '' }
}
</script>
<template>
  <div v-if="[56,4663].includes(chain.activeChainId) && rewards.some(r => r.state === (state === 'Claimable' ? 'claimable' : 'processing'))">
    <div class="font-normal text-sm px-3">{{ t('tradeCuration.title') }}</div>
    <div class="my-3 bg-white rounded-xl py-3 mx-3">
      <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto overflow-y-auto no-scroll-bar mt-1 snap-x">
        <div v-for="reward in rewards.filter(r => r.state === (state === 'Claimable' ? 'claimable' : 'processing'))" :key="reward.pool" class="snap-start shrink-0 first:pl-3 last:pr-3" :class="{ 'pb-5': state === 'Claimable' }">
          <div class="bg-white px-4 py-5 rounded-xl border border-[#FF7A00] w-[260px]">
            <div class="flex items-center gap-2">
              <CommunityLogo :logo="reward.logo" size="xs" />
              <div class="flex flex-col gap-2">
                <div class="text-h3">#{{ reward.tick }}</div>
                <div class="text-h5">{{ formatAmount(Number(reward.amount)) }}</div>
              </div>
            </div>
            <button v-if="isProfile" class="flex items-center justify-center bg-gradient-primary h-10 rounded-full w-full text-white text-h3 mt-4" :disabled="!!claiming || reward.state !== 'claimable'" @click="claim(reward)">
              {{ claiming === reward.pool ? t('tradeCuration.claiming') : reward.state === 'claimable' ? t('claim') : t('pendingSettled') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
