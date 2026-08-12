<script setup lang="ts">
import type { FeedTokenSheetAsset, Tweet } from '@/types'
import { computed } from 'vue'
import { useStateStore } from '@/stores/common'
import { formatUsd, formatUsdCompact } from '@/utils/format'
import CommunityLogo from '@/components/common/CommunityLogo.vue'

const props = defineProps<{ tweet: Tweet }>()
const stateStore = useStateStore()
const emit = defineEmits<{ openDetails: [asset: FeedTokenSheetAsset] }>()
const price = computed(() => Number(props.tweet.price || 0) * stateStore.ethPrice)
const marketCap = computed(() => Number(props.tweet.marketCap || 0) * stateStore.ethPrice)
const change = computed(() => Number(props.tweet.priceChange24h || 0))
function openDetails() {
  if (!props.tweet.tick || !props.tweet.token) return
  emit('openDetails', {
    tick: props.tweet.tick,
    token: props.tweet.token,
    name: props.tweet.tick,
    logo: props.tweet.logo,
    price: props.tweet.price,
    marketCap: props.tweet.marketCap,
    priceChange24h: props.tweet.priceChange24h,
    sparkline24h: props.tweet.sparkline24h,
    listed: props.tweet.listed,
    creatorName: props.tweet.twitterName,
    creatorUsername: props.tweet.twitterUsername,
    creatorProfile: props.tweet.profile,
    sellsman: props.tweet.ethAddr || undefined,
  })
}
</script>

<template>
  <button type="button" class="mt-3 flex w-full items-center justify-between rounded-xl border bg-surface-2 px-3 py-2.5" @click.stop="openDetails">
    <div class="flex min-w-0 items-center gap-2.5">
      <CommunityLogo :logo="tweet.logo" size="xs" :shadow="false" class="!rounded-full" />
      <div class="min-w-0 text-left"><span class="block text-xs text-grey-64">Community token</span><strong class="block truncate text-sm text-content">{{ tweet.tick }}</strong></div>
    </div>
    <div class="ml-3 text-right">
      <strong class="block text-sm text-content tabular-nums">{{ formatUsd(price) }}</strong>
      <span class="text-xs font-semibold tabular-nums" :class="change >= 0 ? 'text-up' : 'text-down'">{{ change >= 0 ? '△ +' : '▽ ' }}{{ change.toFixed(2) }}%</span>
      <span v-if="marketCap" class="ml-2 text-[10px] text-grey-64">{{ formatUsdCompact(marketCap) }} MC</span>
    </div>
  </button>
</template>
