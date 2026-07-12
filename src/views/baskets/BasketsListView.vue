<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useBasketList } from '@/composables/baskets/useBasketList'
import BasketChainGate from './components/BasketChainGate.vue'
import BasketCard from './components/BasketCard.vue'
import {
  SPECTRUM_MINI_ATTRIBUTION,
  SPECTRUM_REPO_URL,
} from '@/config/spectrum'
import { getSpectrumDeployment } from '@/utils/spectrum/deployments'
import { SPECTRUM_CHAIN_ID } from '@/config/spectrum'
import { ROBINHOOD_CHAIN } from '@/config/chains'

const {
  isLoading,
  hasError,
  errorMessage,
  searchQuery,
  filteredBaskets,
  refresh,
} = useBasketList()

const list = computed(() => filteredBaskets())
const factory = getSpectrumDeployment(SPECTRUM_CHAIN_ID)?.factory
const factoryUrl = factory
  ? `${ROBINHOOD_CHAIN.browser.replace(/\/$/, '')}/address/${factory}`
  : SPECTRUM_REPO_URL

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="w-full max-w-3xl mx-auto px-4 py-4 web:py-6">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h1 class="text-xl web:text-2xl font-semibold text-content">{{ $t('baskets.title') }}</h1>
        <p class="text-sm text-grey-64 mt-1">{{ $t('baskets.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 px-3 h-9 rounded-lg border border-gray-200 text-sm text-content hover:bg-surface-2"
        :disabled="isLoading"
        @click="refresh(true)"
      >
        {{ $t('baskets.refresh') }}
      </button>
    </div>

    <BasketChainGate />

    <input
      v-model="searchQuery"
      type="search"
      class="w-full h-10 mb-4 px-3 rounded-lg border border-gray-200 bg-surface text-content text-sm outline-none focus:border-orange-normal"
      :placeholder="$t('baskets.searchPlaceholder')"
    >

    <!-- 有壳数据就出列表，不再被 enrich 挡住 -->
    <div v-if="isLoading && list.length === 0" class="py-16 text-center text-grey-64 text-sm">
      {{ $t('baskets.loading') }}
    </div>
    <div v-else-if="hasError && list.length === 0" class="py-16 text-center text-red-normal text-sm">
      {{ errorMessage || $t('baskets.loadFailed') }}
    </div>
    <div v-else-if="list.length === 0" class="py-16 text-center text-grey-64 text-sm">
      {{ $t('baskets.empty') }}
    </div>
    <div v-else class="flex flex-col gap-3">
      <BasketCard v-for="b in list" :key="b.address" :basket="b" />
    </div>

    <p class="mt-8 text-center text-xs text-grey-64">
      <a :href="SPECTRUM_REPO_URL" target="_blank" rel="noopener noreferrer" class="underline hover:text-content">
        {{ SPECTRUM_MINI_ATTRIBUTION }}
      </a>
      <template v-if="factory">
        ·
        <a :href="factoryUrl" target="_blank" rel="noopener noreferrer" class="underline hover:text-content">
          {{ $t('baskets.verifyFactory') }}
        </a>
      </template>
    </p>
  </div>
</template>
