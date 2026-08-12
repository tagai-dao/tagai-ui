<script setup lang="ts">
import type { Community } from '@/types'
import { computed } from 'vue'
import { useStateStore } from '@/stores/common'
import { formatUsd, formatUsdCompact } from '@/utils/format'
import CommunityLogo from '@/components/common/CommunityLogo.vue'

const props = defineProps<{ community: Community }>()
const stateStore = useStateStore()
const marketCapUsd = computed(() => Number(props.community.marketCap || 0) * stateStore.ethPrice)
const priceUsd = computed(() => Number(props.community.price || 0) * stateStore.ethPrice)
const change = computed(() => Number(props.community.priceChange24h || 0))
</script>

<template>
  <article class="compact-token-card" role="button" tabindex="0">
    <div class="flex min-w-0 items-center gap-3">
      <CommunityLogo :logo="community.logo" size="md" :shadow="false" class="!rounded-full" />
      <div class="min-w-0">
        <h3 class="truncate text-base font-semibold text-content">{{ community.name || community.tick }}</h3>
        <p class="mt-0.5 text-sm font-medium text-grey-64">{{ formatUsdCompact(marketCapUsd) }} MC</p>
      </div>
    </div>
    <div class="ml-3 text-right">
      <strong class="block text-base font-semibold tabular-nums text-content">{{ formatUsd(priceUsd) }}</strong>
      <span v-if="typeof community.priceChange24h === 'number'" class="mt-0.5 block text-sm font-semibold tabular-nums" :class="change >= 0 ? 'text-up' : 'text-down'">
        {{ change >= 0 ? '△ +' : '▽ ' }}{{ change.toFixed(2) }}%
      </span>
      <span v-else class="mt-0.5 block text-sm text-grey-64">24H —</span>
    </div>
  </article>
</template>

<style scoped>
.compact-token-card { display:flex; min-height:76px; align-items:center; justify-content:space-between; padding:12px 14px; border:1px solid var(--border-base); border-radius:16px; background:var(--surface); cursor:pointer; transition:.18s ease; }
.compact-token-card:hover { border-color:#fe913f; box-shadow:0 8px 24px rgba(31,25,20,.06); transform:translateY(-1px); }
</style>
