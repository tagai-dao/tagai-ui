<script setup lang="ts">
import { computed, reactive } from 'vue'
import { parseUnits } from 'viem'
import type { NutboxIndexBrokerPool } from '@/types/nutbox'
import { formatToken, type NutboxNftPoolModel } from '@/composables/useNutboxNftPool'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { handleErrorTip, notify } from '@/utils/notify'
import NftArtwork from './NftArtwork.vue'

const props = defineProps<{ pool: NutboxIndexBrokerPool; model: NutboxNftPoolModel }>()
const modalStore = useModalStore()
const { state, loading, error, action, connected, ownedNfts, approveErc20, miningAction } = props.model
const amounts = reactive<Record<string, string>>({})
const isStake = computed(() => props.pool.miningMode === 'stake' || props.pool.nftTemplateKind === 'STAKE')
const miningToken = computed(() => props.pool.indexMiningToken || props.pool.communityToken)
const miningAprBps = computed<bigint | null>(() => {
  if (!state.rewardSummaryAvailable || state.minimumWeight <= 0n) return null
  const totalWeightAfter = state.totalActiveIndexWeight + state.minimumWeight
  if (totalWeightAfter <= 0n) return null
  const annualRewards = state.injectedRewards24h * 365n * state.minimumWeight / totalWeightAfter
  if (props.pool.indexToken?.toLowerCase() === miningToken.value.toLowerCase()) {
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

const amountFor = (id: bigint) => {
  try { return parseUnits(amounts[id.toString()] || '0', state.miningDecimals) } catch { return 0n }
}
const connect = () => modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
const run = async (fn: () => Promise<unknown>, message: string) => {
  try { await fn(); notify({ type: 'success', message }) } catch (reason) { handleErrorTip(reason) }
}
const approve = (amount: bigint) => run(
  () => approveErc20(miningToken.value, props.pool.pool, amount, 'approve-mining'),
  `${state.miningSymbol} approved`,
)
const activateOrIncrease = (tokenId: bigint, active: boolean) => {
  const amount = amountFor(tokenId)
  if (isStake.value) {
    if (amount <= 0n) return
    if (state.miningAllowance < amount) return approve(amount)
    return run(() => miningAction('stakeIndexMining', tokenId, amount), active ? 'Mining stake increased' : 'Mining activated')
  }
  if (!active) {
    const required = state.activationPrice
    if (state.miningAllowance < required) return approve(required)
    return run(() => miningAction('activateIndexMining', tokenId), 'Mining activated')
  }
  if (amount <= 0n) return
  if (state.miningAllowance < amount) return approve(amount)
  return run(() => miningAction('upgradeIndexMining', tokenId, amount), 'Mining weight upgraded')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-2xl bg-surface p-4">
      <h2 class="text-xl font-semibold text-content">Activate mining</h2>
      <p class="mt-1 text-sm text-grey-3f">
        {{ isStake ? `Stake ${state.miningSymbol} on an NFT to activate or increase its index-mining weight. The stake follows the NFT and can be withdrawn.` : `Burn ${state.miningSymbol} to activate or increase an NFT's index-mining weight.` }}
      </p>
      <div class="mt-4 grid grid-cols-2 gap-2 web:grid-cols-5">
        <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Est. APR (minimum unit)</span><b class="mt-1 block">{{ formatApr(miningAprBps) }}</b></div>
        <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Injected in 24h</span><b class="mt-1 block">{{ formatToken(state.injectedRewards24h, state.indexDecimals) }} {{ state.indexSymbol }}</b></div>
        <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Active weight</span><b class="mt-1 block">{{ formatToken(state.totalActiveIndexWeight, state.miningDecimals) }}</b></div>
        <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Minimum unit</span><b class="mt-1 block">{{ formatToken(state.minimumWeight, state.miningDecimals) }} {{ state.miningSymbol }}</b></div>
        <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Queued rewards</span><b class="mt-1 block">{{ formatToken(state.queuedRewards, state.indexDecimals) }} {{ state.indexSymbol }}</b></div>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{{ error }}</div>
    <div v-if="loading" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">Loading mining positions…</div>
    <div v-else-if="!connected" class="rounded-2xl bg-surface p-8 text-center"><p class="text-grey-3f">Connect wallet to view and manage your NFTs.</p><button class="mt-4 rounded-xl bg-grey-normal px-4 py-3 text-white" @click="connect">Connect wallet</button></div>
    <div v-else-if="ownedNfts.length === 0" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">This wallet has no NFTs in the collection.</div>

    <div v-else class="grid gap-3 web:grid-cols-2">
      <article v-for="nft in ownedNfts" :key="nft.tokenId.toString()" class="rounded-2xl bg-surface p-4">
        <div class="grid grid-cols-[112px_1fr] gap-4">
          <NftArtwork :src="nft.image" :sources="nft.imageFallbacks" :alt="`NFT #${nft.tokenId}`" />
          <div>
            <div class="flex justify-between"><b>{{ state.name }} #{{ nft.tokenId }}</b><span class="rounded-full px-2 py-0.5 text-xs" :class="nft.indexMiningActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'">{{ nft.indexMiningActive ? 'Active' : 'Inactive' }}</span></div>
            <dl class="mt-2 space-y-1 text-sm">
              <div class="flex justify-between"><dt class="text-grey-3f">Index weight</dt><dd>{{ formatToken(nft.indexMiningWeight, state.miningDecimals) }}</dd></div>
              <div class="flex justify-between"><dt class="text-grey-3f">Pending rewards</dt><dd>{{ formatToken(nft.pendingIndexRewards, state.indexDecimals) }} {{ state.indexSymbol }}</dd></div>
            </dl>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <input v-model="amounts[nft.tokenId.toString()]" type="number" min="0" class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm" :placeholder="`${isStake ? 'Stake' : 'Burn'} ${state.miningSymbol}`" />
          <button class="rounded-xl bg-grey-normal px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="!!action" @click="activateOrIncrease(nft.tokenId, nft.indexMiningActive)">{{ nft.indexMiningActive ? 'Increase' : 'Activate' }}</button>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button v-if="isStake && nft.indexMiningWeight > 0n" class="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50" :disabled="!!action || amountFor(nft.tokenId) <= 0n" @click="run(() => miningAction('unstakeIndexMining', nft.tokenId, amountFor(nft.tokenId)), 'Mining stake withdrawn')">Unstake</button>
          <button class="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50" :disabled="!!action || nft.pendingIndexRewards <= 0n" @click="run(() => miningAction('claimIndexRewards', nft.tokenId), 'Index rewards claimed')">Claim rewards</button>
        </div>
      </article>
    </div>
  </div>
</template>
