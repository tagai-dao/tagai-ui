<script setup lang="ts">
import { computed, watch } from 'vue'
import { formatEther } from 'viem'
import type { NutboxIndexBrokerPool } from '@/types/nutbox'
import { formatToken, type NutboxNftPoolModel } from '@/composables/useNutboxNftPool'
import { useCommunityStore } from '@/stores/community'
import { getNutboxPoolScale, getV10DistributionInfo } from '@/utils/pump'

const props = defineProps<{ pool: NutboxIndexBrokerPool; model: NutboxNftPoolModel }>()
const emit = defineEmits<{ mining: []; rewards: [] }>()
const { state } = props.model
const communityStore = useCommunityStore()

const isStake = computed(() => props.pool.miningMode === 'stake' || props.pool.nftTemplateKind === 'STAKE')
const miningAprBps = computed<bigint | null>(() => {
  if (!state.rewardSummaryAvailable || state.minimumWeight <= 0n) return null
  const totalWeightAfter = state.totalActiveIndexWeight + state.minimumWeight
  if (totalWeightAfter <= 0n) return null
  const annualRewards = state.injectedRewards24h * 365n * state.minimumWeight / totalWeightAfter
  if (props.pool.indexToken?.toLowerCase() === (props.pool.indexMiningToken || props.pool.communityToken).toLowerCase()) {
    return annualRewards * 10_000n / state.minimumWeight
  }
  if (state.indexNativeQuote <= 0n || state.miningNativeQuote <= 0n) return null
  const indexUnit = 10n ** BigInt(state.indexDecimals)
  const miningUnit = 10n ** BigInt(state.miningDecimals)
  return annualRewards * state.indexNativeQuote * miningUnit * 10_000n
    / (indexUnit * state.minimumWeight * state.miningNativeQuote)
})
const formatApr = (value: bigint | null) => value === null
  ? '—'
  : `${(Number(value) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const holderAprBps = computed<bigint | null>(() => {
  const levelOneWeight = state.levelRules[0]?.weight || 0n
  if (state.holderPoolDailyRewards <= 0n || levelOneWeight <= 0n || state.totalWeight <= 0n || state.communityTokenPrice <= 0n) return null
  const annualRewards = state.holderPoolDailyRewards * 365n * levelOneWeight / state.totalWeight
  return annualRewards * 10_000n / state.communityTokenPrice
})

const loadHolderApr = async () => {
  state.holderPoolDailyRewards = 0n
  const community = communityStore.currentSelectedCommunity
  if (!community?.communityAddress || !community.socialPoolAddress || !state.totalWeight || !state.communityTokenPrice) return
  try {
    const info = await getV10DistributionInfo(community.communityAddress, community.socialPoolAddress)
    if (!info) return
    const now = BigInt(Math.floor(Date.now() / 1000))
    let communityDailyRewards = 0n
    if (info.calculatorType === 'hourly' && info.hourly) {
      const socialDaily = info.hourly.dailyRewards[info.hourly.todayIndex] || 0n
      const socialScale = (10_000n - info.hourly.feeRatio) * info.hourly.poolRatio
      if (socialScale > 0n) communityDailyRewards = socialDaily * 100_000_000n / socialScale
    } else if (info.calculatorType === 'timestamp') {
      const phase = info.phases?.find(item => item.startCursor <= now && item.stopCursor >= now)
      if (phase) communityDailyRewards = phase.amount * 86_400n
    } else if (info.calculatorType === 'block') {
      const phase = info.phases?.[0]
      if (phase) communityDailyRewards = phase.amount * 28_800n
    }
    const poolScale = await getNutboxPoolScale(community.communityAddress as `0x${string}`, props.pool.pool)
    const poolDailyRewards = communityDailyRewards * poolScale.scaleNumerator / poolScale.scaleDenominator
    state.holderPoolDailyRewards = poolDailyRewards
  } catch {
    state.holderPoolDailyRewards = 0n
  }
}

watch(
  [() => props.pool.pool, () => state.totalWeight, () => state.communityTokenPrice, () => state.levelRules.length],
  loadHolderApr,
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4 border-b border-line px-4 py-5 web:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(120px,1fr))] web:items-center web:px-5">
    <div>
      <strong class="block text-xl text-content">{{ state.name || pool.name || 'NFT' }}</strong>
      <span class="mt-1 inline-flex rounded-full bg-surface-2 px-2 py-1 text-xs text-grey-3f">{{ state.symbol }}</span>
      <div class="mt-3 grid gap-2">
        <button class="flex items-center justify-between rounded-lg border border-emerald-300 px-3 py-1.5 text-left text-xs" @click="emit('mining')">
          <span>⚡ {{ isStake ? 'Staking mining APR' : 'Mining APR' }}</span><b class="text-emerald-600">{{ formatApr(miningAprBps) }}</b>
        </button>
        <button class="flex items-center justify-between rounded-lg border border-amber-300 px-3 py-1.5 text-left text-xs" @click="emit('rewards')">
          <span>◆ Holder APR</span><b class="text-amber-600">{{ formatApr(holderAprBps) }}</b>
        </button>
      </div>
    </div>
    <div><span class="block text-xs text-grey-3f">NFT supply</span><b class="mt-2 block">{{ state.totalSupply }} / {{ state.maxSupply }}</b></div>
    <div><span class="block text-xs text-grey-3f">Mint cost per NFT</span><b class="mt-2 block">{{ formatToken(state.communityTokenPrice, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
    <div><span class="block text-xs text-grey-3f">Public mint price</span><b class="mt-2 block">{{ formatEther(state.nativePrice) }} BNB</b></div>
    <div><span class="block text-xs text-grey-3f">Public mint referral</span><b class="mt-2 block">{{ (state.referralBps / 100).toFixed(2) }}%</b></div>
  </div>
</template>
