<script setup lang="ts">
import type { FeedTokenSheetAsset, FeedTrade } from '@/types'
import { computed } from 'vue'
import { useStateStore } from '@/stores/common'
import { formatTokenAmount, formatUsd, formatUsdCompact } from '@/utils/format'
import { parseTimestamp } from '@/utils/helper'
import CommunityLogo from '@/components/common/CommunityLogo.vue'

const props = defineProps<{ trade: FeedTrade }>()
const stateStore = useStateStore()
const emit = defineEmits<{ openDetails: [asset: FeedTokenSheetAsset] }>()
const isBuy = computed(() => props.trade.isBuy === true || Number(props.trade.isBuy) === 1)
const usdAmount = computed(() => Number(props.trade.ethAmount || 0) * stateStore.ethPrice)
const marketCap = computed(() => Number(props.trade.marketCap || 0) * stateStore.ethPrice)
function openDetails() {
  emit('openDetails', {
    tick: props.trade.tick,
    token: props.trade.token,
    name: props.trade.name || props.trade.tick,
    logo: props.trade.logo,
    price: props.trade.price,
    marketCap: props.trade.marketCap,
    priceChange24h: props.trade.priceChange24h,
    listed: (props.trade as any).listed,
    creatorName: props.trade.twitterName,
    creatorUsername: props.trade.twitterUsername,
    creatorProfile: props.trade.profile,
    sellsman: props.trade.trader,
  })
}
</script>

<template>
  <article class="rounded-2xl bg-white px-4 py-3">
    <div class="flex items-center gap-3">
      <img v-if="trade.profile" :src="trade.profile.replace('normal', '200x200')" class="h-10 w-10 rounded-full object-cover" alt="">
      <div v-else class="h-10 w-10 rounded-full bg-grey-light-active" />
      <div class="min-w-0 flex-1"><strong class="block truncate text-sm text-content">{{ trade.twitterName || trade.twitterUsername }}</strong><span class="text-xs text-grey-64">@{{ trade.twitterUsername }} · {{ parseTimestamp(trade.timestamp) }}</span></div>
      <span class="rounded-lg border px-3 py-1 text-sm font-semibold" :class="isBuy ? 'border-up text-up' : 'border-orange-normal text-orange-normal'">{{ isBuy ? 'Buy' : 'Sell' }}</span>
    </div>
    <button class="mt-3 flex w-full items-center justify-between rounded-xl border bg-surface-2 p-3" @click.stop="openDetails">
      <div class="flex min-w-0 items-center gap-2.5"><CommunityLogo :logo="trade.logo" size="xs" :shadow="false" class="!rounded-full" /><div class="text-left"><strong class="block text-sm text-content">{{ trade.name || trade.tick }}</strong><span class="text-xs text-grey-64">{{ formatTokenAmount(trade.amount) }} {{ trade.tick }}</span></div></div>
      <div class="text-right"><strong class="block text-sm tabular-nums text-content">{{ formatUsd(usdAmount) }}</strong><span v-if="marketCap" class="text-xs text-grey-64">{{ formatUsdCompact(marketCap) }} MC</span></div>
    </button>
  </article>
</template>
