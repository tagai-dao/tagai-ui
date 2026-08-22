<script setup lang="ts">
import { computed, toRef } from 'vue'
import { formatEther } from 'viem'
import type { NutboxIndexBrokerPool } from '@/types/nutbox'
import { useNutboxNftPool, formatToken } from '@/composables/useNutboxNftPool'
import { useChainStore } from '@/stores/chain'

const props = defineProps<{ pool: NutboxIndexBrokerPool }>()
const { state, loading, error } = useNutboxNftPool(toRef(props, 'pool'))
const chainStore = useChainStore()
const explorer = computed(() => chainStore.browser.replace(/\/$/, ''))
const utilization = computed(() => state.maxSupply > 0n ? Number(state.inventoryCount * 10_000n / state.maxSupply) / 100 : 0)
const short = (value?: string) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—'
const contracts = computed(() => [
  ['NFT collection', props.pool.pool], ['Renderer', props.pool.renderer], ['AMM vault', props.pool.amm],
  ['Community token', props.pool.communityToken], ['Mining token', props.pool.indexMiningToken], ['Index reward token', props.pool.indexToken],
].filter((item): item is [string, string] => Boolean(item[1])))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{{ error }}</div>
    <div v-if="loading" class="rounded-2xl bg-surface p-8 text-center text-grey-3f">Loading NFT information…</div>
    <template v-else>
      <div class="rounded-2xl bg-surface p-4">
        <h2 class="text-xl font-semibold text-content">Fees & AMM</h2>
        <div class="mt-4 grid grid-cols-2 gap-2 web:grid-cols-4">
          <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Queue trade fee</span><b class="mt-1 block">{{ (state.normalFeeBps / 100).toFixed(2) }}%</b></div>
          <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Specific NFT fee</span><b class="mt-1 block">{{ (state.specificFeeBps / 100).toFixed(2) }}%</b></div>
          <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Platform fee quote</span><b class="mt-1 block">{{ formatEther(state.platformFee) }} BNB</b></div>
          <div class="rounded-xl bg-surface-2 p-3"><span class="text-xs text-grey-3f">Queue BNB fee</span><b class="mt-1 block">{{ formatEther(state.normalFee) }} BNB</b></div>
        </div>
      </div>

      <div class="rounded-2xl bg-surface p-4">
        <h2 class="text-xl font-semibold text-content">Market & mining</h2>
        <div class="mt-4 grid grid-cols-2 gap-2 web:grid-cols-4">
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Supply</span><b class="mt-1 block">{{ state.totalSupply }} / {{ state.maxSupply }}</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">AMM inventory</span><b class="mt-1 block">{{ state.inventoryCount }} NFTs</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">AMM utilization</span><b class="mt-1 block">{{ utilization.toFixed(2) }}%</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Mint cost</span><b class="mt-1 block">{{ formatToken(state.communityTokenPrice, state.communityDecimals) }} {{ state.communitySymbol }}</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Public mint</span><b class="mt-1 block">{{ formatEther(state.nativePrice) }} BNB</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Referral</span><b class="mt-1 block">{{ (state.referralBps / 100).toFixed(2) }}%</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Community weight</span><b class="mt-1 block">{{ state.totalWeight }}</b></div>
          <div class="rounded-xl border border-line p-3"><span class="text-xs text-grey-3f">Active index weight</span><b class="mt-1 block">{{ formatToken(state.totalActiveIndexWeight, state.miningDecimals) }}</b></div>
        </div>
      </div>

      <div class="rounded-2xl bg-surface p-4">
        <h2 class="text-xl font-semibold text-content">Contracts</h2>
        <div class="mt-3 divide-y divide-line">
          <div v-for="item in contracts" :key="item[0]" class="flex items-center justify-between gap-3 py-3 text-sm"><span class="text-grey-3f">{{ item[0] }}</span><a :href="`${explorer}/address/${item[1]}`" target="_blank" class="font-mono text-primary" :title="item[1]">{{ short(item[1]) }} ↗</a></div>
        </div>
      </div>
    </template>
  </div>
</template>
