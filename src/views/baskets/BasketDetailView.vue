<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBasketDetail } from '@/composables/baskets/useBasketDetail'
import BasketChainGate from './components/BasketChainGate.vue'
import BasketTradePanel from './components/BasketTradePanel.vue'
import { feeSplit } from '@/utils/spectrum/fee-model'
import { hasSpectrumFeeWallet } from '@/config/spectrum'
import {
  SPECTRUM_MINI_ATTRIBUTION,
  SPECTRUM_REPO_URL,
} from '@/config/spectrum'
import { ROBINHOOD_CHAIN } from '@/config/chains'

const route = useRoute()
const router = useRouter()
const { detail, isLoading, hasError, errorMessage, load } = useBasketDetail()

const address = computed(() => String(route.params.address || ''))

const explorerBasket = computed(() => {
  if (!detail.value) return ''
  return `${ROBINHOOD_CHAIN.browser.replace(/\/$/, '')}/address/${detail.value.address}`
})

const split = computed(() => {
  const d = detail.value
  if (!d) return null
  return feeSplit(d.creatorShareBps, {
    hasInterface: hasSpectrumFeeWallet(),
    hasLauncher: !!d.launcher,
  })
})

const formatUsd = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

onMounted(() => void load(address.value))
watch(address, (a) => void load(a))
</script>

<template>
  <div class="w-full max-w-3xl mx-auto px-4 py-4 web:py-6">
    <button
      type="button"
      class="text-sm text-orange-normal mb-3"
      @click="router.push('/baskets')"
    >
      ← {{ $t('baskets.backToList') }}
    </button>

    <BasketChainGate />

    <div v-if="isLoading" class="py-16 text-center text-grey-64 text-sm">
      {{ $t('baskets.loading') }}
    </div>
    <div v-else-if="hasError || !detail" class="py-16 text-center text-red-normal text-sm">
      {{ errorMessage || $t('baskets.loadFailed') }}
    </div>
    <template v-else>
      <div class="mb-4">
        <h1 class="text-xl web:text-2xl font-semibold text-content">{{ detail.name }}</h1>
        <div class="text-sm text-grey-64 mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>${{ detail.symbol }}</span>
          <a
            v-if="explorerBasket"
            :href="explorerBasket"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-content"
          >
            {{ $t('baskets.viewContract') }}
          </a>
        </div>
      </div>

      <div class="grid grid-cols-2 web:grid-cols-4 gap-3 mb-6">
        <div class="rounded-lg bg-surface-2 p-3">
          <div class="text-xs text-grey-64">{{ $t('baskets.aum') }}</div>
          <div class="text-base font-semibold text-content mt-1">{{ formatUsd(detail.aumUsd) }}</div>
        </div>
        <div class="rounded-lg bg-surface-2 p-3">
          <div class="text-xs text-grey-64">{{ $t('baskets.nav') }}</div>
          <div class="text-base font-semibold text-content mt-1">
            {{ detail.navPerToken > 0 ? `$${detail.navPerToken.toFixed(4)}` : '—' }}
          </div>
        </div>
        <div class="rounded-lg bg-surface-2 p-3">
          <div class="text-xs text-grey-64">{{ $t('baskets.fee') }}</div>
          <div class="text-base font-semibold text-content mt-1">
            {{ (detail.basketFeeBps / 100).toFixed(2) }}%
          </div>
        </div>
        <div class="rounded-lg bg-surface-2 p-3">
          <div class="text-xs text-grey-64">{{ $t('baskets.assets') }}</div>
          <div class="text-base font-semibold text-content mt-1">{{ detail.basketLength }}</div>
        </div>
      </div>

      <div class="web:grid web:grid-cols-5 web:gap-6 mb-6">
        <div class="web:col-span-3 mb-6 web:mb-0">
          <h2 class="text-base font-semibold text-content mb-3">{{ $t('baskets.holdings') }}</h2>
          <div class="rounded-xl border border-gray-200 overflow-hidden">
            <div
              v-for="h in detail.holdings"
              :key="h.asset"
              class="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 text-sm"
            >
              <div>
                <div class="font-medium text-content">{{ h.symbol }}</div>
                <div class="text-xs text-grey-64">{{ h.targetWeightPct.toFixed(1) }}%</div>
              </div>
              <div class="text-right">
                <div class="text-content">{{ formatUsd(h.valueUsd) }}</div>
                <div class="text-xs" :class="h.priced ? 'text-grey-64' : 'text-red-normal'">
                  {{ h.priced ? `$${h.priceUsd.toFixed(4)}` : $t('baskets.unpriced') }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="split" class="mt-4 text-xs text-grey-64 space-y-1">
            <div class="font-medium text-content text-sm mb-1">{{ $t('baskets.feeSplit') }}</div>
            <div>{{ $t('baskets.feeBurn') }}: {{ pct(split.burn) }}</div>
            <div>{{ $t('baskets.feeInterface') }}: {{ pct(split.interface) }}</div>
            <div>{{ $t('baskets.feeLauncher') }}: {{ pct(split.launcher) }}</div>
            <div>{{ $t('baskets.feeCreator') }}: {{ pct(split.creator) }}</div>
            <div>{{ $t('baskets.feeHolders') }}: {{ pct(split.holders) }}</div>
          </div>
        </div>

        <div class="web:col-span-2">
          <BasketTradePanel :detail="detail" @traded="load(address)" />
        </div>
      </div>

      <p class="text-center text-xs text-grey-64">
        <a :href="SPECTRUM_REPO_URL" target="_blank" rel="noopener noreferrer" class="underline">
          {{ SPECTRUM_MINI_ATTRIBUTION }}
        </a>
      </p>
    </template>
  </div>
</template>
