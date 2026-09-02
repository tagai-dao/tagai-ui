<script setup lang="ts">
import type { FeedTokenSheetAsset, FeedTrade } from '@/types'
import { computed } from 'vue'
import { useStateStore } from '@/stores/common'
import { formatTokenAmount, formatUsd, formatUsdCompact } from '@/utils/format'
import { formatAddress, parseTimestamp } from '@/utils/helper'
import CommunityLogo from '@/components/common/CommunityLogo.vue'
import AccountOriginBadges from '@/components/common/AccountOriginBadges.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'

const props = defineProps<{ trade: FeedTrade }>()
const stateStore = useStateStore()
const emit = defineEmits<{ openDetails: [asset: FeedTokenSheetAsset] }>()
const isBuy = computed(() => props.trade.isBuy === true || Number(props.trade.isBuy) === 1)
const usdAmount = computed(() => {
  const indexedUsd = Number(props.trade.amountUsd ?? props.trade.quoteAmountUsd)
  return Number.isFinite(indexedUsd) && indexedUsd > 0
    ? indexedUsd
    : Number(props.trade.ethAmount || 0) * stateStore.ethPrice
})
const marketCap = computed(() => Number(props.trade.marketCap || 0) * stateStore.ethPrice)
const traderLabel = computed(() => props.trade.twitterName || props.trade.twitterUsername || formatAddress(props.trade.trader, 5, 4))
const traderHandle = computed(() => props.trade.twitterUsername
  ? `@${props.trade.twitterUsername}`
  : formatAddress(props.trade.trader, 5, 4))
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
    isImport: props.trade.isImport,
    version: props.trade.version,
    pair: props.trade.pair,
    dexVersion: props.trade.dexVersion,
    creatorName: props.trade.twitterName,
    creatorUsername: props.trade.twitterUsername,
    creatorProfile: props.trade.profile,
    creatorTwitterId: props.trade.twitterId,
    creatorSteemId: props.trade.steemId,
    creatorFollowers: props.trade.followers,
    creatorFollowings: props.trade.followings,
    creatorCredit: props.trade.credit,
    creatorCreditFactor: props.trade.creditFactor,
    creatorAccountType: props.trade.accountType,
    sellsman: props.trade.trader,
  })
}
</script>

<template>
  <article class="rounded-2xl bg-white px-4 py-3">
    <div class="flex items-center gap-3">
      <UserAvatar
        :twitter-id="trade.twitterId"
        :profile-img="trade.profile"
        :name="trade.twitterName || traderLabel"
        :username="trade.twitterUsername"
        :steem-id="trade.steemId"
        :eth-addr="trade.trader"
        :followers="trade.followers"
        :followings="trade.followings"
        :credit="trade.credit"
        :credit-factor="trade.creditFactor"
        :account-type="trade.accountType"
        :teleported="true"
      >
        <template #avatar-img>
          <img
            v-if="trade.profile"
            :src="trade.profile.replace('normal', '200x200')"
            class="h-10 w-10 min-w-10 cursor-pointer rounded-full bg-color2A object-cover"
            referrerpolicy="no-referrer"
            alt=""
          >
          <img
            v-else
            class="h-10 w-10 min-w-10 cursor-pointer rounded-full bg-color2A object-cover"
            src="~@/assets/icons/icon-default-avatar.svg"
            alt=""
          >
        </template>
      </UserAvatar>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <strong class="truncate text-sm text-content">{{ traderLabel }}</strong>
          <AccountOriginBadges :sources="trade.accountSources" :account-type="trade.accountType" :wallet-type="trade.walletType" :eth-addr="trade.trader" />
        </div>
        <span class="text-xs text-grey-64">{{ traderHandle }} · {{ parseTimestamp(trade.timestamp) }}</span>
      </div>
      <span class="rounded-lg border px-3 py-1 text-sm font-semibold" :class="isBuy ? 'border-up text-up' : 'border-orange-normal text-orange-normal'">{{ isBuy ? 'Buy' : 'Sell' }}</span>
    </div>
    <button class="mt-3 flex w-full items-center justify-between rounded-xl border bg-surface-2 p-3" @click.stop="openDetails">
      <div class="flex min-w-0 items-center gap-2.5"><CommunityLogo :logo="trade.logo" size="xs" :shadow="false" class="!rounded-full" /><div class="text-left"><strong class="block text-sm text-content">{{ trade.name || trade.tick }}</strong><span class="text-xs text-grey-64">{{ formatTokenAmount(trade.amount) }} {{ trade.tick }}</span></div></div>
      <div class="text-right"><strong class="block text-sm tabular-nums text-content">{{ formatUsd(usdAmount) }}</strong><span v-if="marketCap" class="text-xs text-grey-64">{{ formatUsdCompact(marketCap) }} MC</span></div>
    </button>
  </article>
</template>
