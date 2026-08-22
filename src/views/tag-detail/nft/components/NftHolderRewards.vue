<script setup lang="ts">
import type { NutboxIndexBrokerPool } from '@/types/nutbox'
import { formatToken, type NutboxNftPoolModel } from '@/composables/useNutboxNftPool'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { handleErrorTip, notify } from '@/utils/notify'
import NftArtwork from './NftArtwork.vue'

const props = defineProps<{ pool: NutboxIndexBrokerPool; model: NutboxNftPoolModel }>()
const { state, loading, error, action, connected, ownedNfts, claimCommunityRewards } = props.model
const modalStore = useModalStore()
const connect = () => modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
const copyReferral = async (tokenId: bigint) => {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', 'nft')
  url.searchParams.set('section', 'mint-amm')
  url.searchParams.set('referrerTokenId', tokenId.toString())
  await navigator.clipboard.writeText(url.toString())
  notify({ type: 'success', message: 'Referral link copied' })
}
const claim = async () => {
  try { await claimCommunityRewards(); notify({ type: 'success', message: 'Community rewards claimed' }) } catch (reason) { handleErrorTip(reason) }
}
const levelApr = (weight: bigint) => {
  if (state.holderPoolDailyRewards <= 0n || state.totalWeight <= 0n || state.communityTokenPrice <= 0n) return null
  const annualRewards = state.holderPoolDailyRewards * 365n * weight / state.totalWeight
  return annualRewards * 10_000n / state.communityTokenPrice
}
const formatApr = (value: bigint | null) => value === null
  ? '—'
  : `${(Number(value) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-2xl bg-surface p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h2 class="text-xl font-semibold text-content">Holder rewards</h2><p class="mt-1 max-w-2xl text-sm text-grey-3f">Public mints made through an NFT referral link increase that NFT's referral count. Reaching each threshold upgrades its community-mining weight.</p></div>
        <div class="rounded-xl bg-surface-2 px-4 py-3 text-right"><span class="block text-xs text-grey-3f">Public-mint referral</span><b>{{ (state.referralBps / 100).toFixed(2) }}%</b></div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2 web:grid-cols-4">
        <div v-for="rule in state.levelRules" :key="rule.level" class="rounded-xl border border-line p-3">
          <div class="flex items-center justify-between gap-2"><b>Lv.{{ rule.level }}</b><span class="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">APR {{ formatApr(levelApr(rule.weight)) }}</span></div>
          <span class="mt-2 block text-xs text-grey-3f">{{ rule.threshold.toString() }} referrals</span><span class="mt-2 block text-sm">Weight {{ rule.weight.toString() }}</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{{ error }}</div>
    <div v-if="loading" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">Loading holder rewards…</div>
    <div v-else-if="!connected" class="rounded-2xl bg-surface p-8 text-center"><p class="text-grey-3f">Connect wallet to view referral levels and rewards.</p><button class="mt-4 rounded-xl bg-grey-normal px-4 py-3 text-white" @click="connect">Connect wallet</button></div>
    <template v-else>
      <div class="rounded-2xl bg-surface p-4">
        <span class="text-sm text-grey-3f">Community Token rewards for this wallet</span>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3"><b class="text-xl">{{ formatToken(state.pendingCommunityRewards, state.communityDecimals) }} {{ state.communitySymbol }}</b><button class="rounded-xl bg-grey-normal px-4 py-2 text-white disabled:opacity-50" :disabled="!!action || state.pendingCommunityRewards <= 0n" @click="claim">Claim wallet rewards</button></div>
      </div>
      <div v-if="ownedNfts.length === 0" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">This wallet has no NFTs in the collection.</div>
      <div v-else class="grid gap-3 web:grid-cols-2">
        <article v-for="nft in ownedNfts" :key="nft.tokenId.toString()" class="rounded-2xl bg-surface p-4">
          <div class="grid grid-cols-[112px_1fr] gap-4">
            <NftArtwork :src="nft.image" :sources="nft.imageFallbacks" :alt="`NFT #${nft.tokenId}`" />
            <div><div class="flex justify-between"><b>{{ state.name }} #{{ nft.tokenId }}</b><span>Lv.{{ nft.level }}</span></div><dl class="mt-2 space-y-1 text-sm"><div class="flex justify-between"><dt class="text-grey-3f">Referrals</dt><dd>{{ nft.referralCount }}</dd></div><div class="flex justify-between"><dt class="text-grey-3f">Community weight</dt><dd>{{ nft.miningWeight }}</dd></div><div class="flex justify-between"><dt class="text-grey-3f">Mining</dt><dd>{{ nft.miningActive ? 'Active' : 'Inactive' }}</dd></div></dl><button class="mt-3 rounded-lg border border-line px-3 py-2 text-sm" @click="copyReferral(nft.tokenId)">Copy referral link</button></div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
