<script setup lang="ts">
import type { BasketSummary } from '@/utils/spectrum/basket-data'

defineProps<{
  basket: BasketSummary
}>()

const formatUsd = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}
</script>

<template>
  <router-link
    :to="`/baskets/${basket.address}`"
    class="block p-4 rounded-xl border border-gray-200 bg-surface hover:bg-surface-2 transition-colors"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="font-semibold text-content truncate">{{ basket.name }}</div>
        <div class="text-xs text-grey-64 mt-0.5">${{ basket.symbol }}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-sm font-semibold text-content">{{ formatUsd(basket.aumUsd) }}</div>
        <div class="text-xs text-grey-64">{{ $t('baskets.aum') }}</div>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="leg in basket.top.slice(0, 4)"
        :key="leg.address"
        class="text-xs px-2 py-0.5 rounded bg-surface-2 text-grey-normal"
      >
        {{ leg.symbol }} {{ leg.weightPct.toFixed(0) }}%
      </span>
      <span v-if="basket.top.length > 4" class="text-xs text-grey-64 self-center">
        +{{ basket.top.length - 4 }}
      </span>
    </div>
    <div class="mt-2 text-xs text-grey-64">
      {{ $t('baskets.nav') }}: {{ basket.navPerToken > 0 ? `$${basket.navPerToken.toFixed(4)}` : '—' }}
      · {{ basket.basketLength }} {{ $t('baskets.assets') }}
    </div>
  </router-link>
</template>
