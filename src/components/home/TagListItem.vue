<script setup lang="ts">
import type { Community } from '@/types'
import { computed } from 'vue'
import { useCurationStore } from '@/stores/curation'
import { useStateStore } from '@/stores/common'
import { formatShortDate, formatTokenAmount, formatUsd, formatUsdCompact } from '@/utils/format'
import { parseTimestamp } from '@/utils/helper'
import { getCurrentLocale } from '@/lang'
import { BondingCurveSupply } from '@/config'
import { getTagStyle, parseTagsJson } from '@/composables/useTags'
import IconLinks from '@/components/home/IconLinks.vue'
import Sparkline from '@/components/common/Sparkline.vue'
import CommunityLogo from '@/components/common/CommunityLogo.vue'

const props = defineProps<{ community: Community }>()
const curationStore = useCurationStore()
const stateStore = useStateStore()

const onlineSpace = computed(() =>
  curationStore.allSpaces.some(space => space.tick === props.community.tick),
)
const communityTags = computed(() => parseTagsJson(props.community.tags ?? undefined))
const curveProgress = computed(() => {
  const sold = Number(props.community.bondingCurveSupply ?? 0)
  return Math.max(0, (sold / BondingCurveSupply) * 100)
})
const createTimeText = computed(() => {
  if (!props.community.createAt) return ''
  const timestamp = new Date(props.community.createAt).getTime()
  if (Number.isNaN(timestamp)) return ''
  if (Date.now() - timestamp < 30 * 24 * 3600 * 1000) return parseTimestamp(props.community.createAt)
  return formatShortDate(props.community.createAt, getCurrentLocale())
})

// App/PWA mobile compact card values.
const marketCapUsd = computed(() => Number(props.community.marketCap || 0) * stateStore.ethPrice)
const priceUsd = computed(() => Number(props.community.price || 0) * stateStore.ethPrice)
const change = computed(() => Number(props.community.priceChange24h || 0))
</script>

<template>
  <div class="contents">
    <!-- Android + narrow PWA: reviewed compact token card. -->
    <article class="compact-token-card flex web:hidden" role="button" tabindex="0">
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

    <!-- PC web: preserve the original information-rich token card. -->
    <div class="hidden web:flex bg-grey-fa border-[1px] border-white rounded-2xl py-5 px-3.5 gap-3">
      <div class="relative w-20 h-20 min-w-20 min-h-20">
        <CommunityLogo :logo="community.logo" :show-audio="onlineSpace" />
        <div class="absolute w-full h-full -right-[3px] -bottom-[3px] overflow-hidden">
          <div v-if="community.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm shadow-tag-logo transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] whitespace-nowrap">
            {{ community.isImport ? $t('imported') : $t('listed') }}
          </div>
        </div>
      </div>
      <div class="flex-1 flex flex-col justify-between truncate">
        <div class="flex gap-x-2 items-end flex-wrap">
          <span class="text-grey-normal text-h2 font-bold leading-6" :class="community.listed ? 'text-orange-normal' : ''">{{ community.tick }}</span>
          <div class="flex-1 flex justify-end mt-1">
            <div v-if="community.marketCap" class="flex items-end gap-1.5">
              <span class="font-normal italic text-grey-64 leading-5 text-sm">{{ $t('marketCap') }}</span>
              <span class="font-medium italic text-orange-normal leading-5 text-sm">
                {{ formatUsdCompact(parseFloat(community.marketCap as any) * stateStore.ethPrice) }}
              </span>
              <span v-if="typeof community.priceChange24h === 'number'" class="font-semibold leading-5 text-sm whitespace-nowrap" :class="community.priceChange24h >= 0 ? 'text-up' : 'text-down'">
                {{ community.priceChange24h >= 0 ? '+' : '' }}{{ community.priceChange24h.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
        <div class="flex-1 w-full flex justify-between pt-1">
          <div class="flex-1 truncate">
            <div class="truncate text-grey-5a text-[14px] leading-[20px] font-medium" :title="community.description">
              {{ community.description }}
            </div>
            <div class="flex items-center gap-2 mt-1.5 text-sm text-grey-64">
              <template v-if="!community.listed && !community.isImport && typeof community.bondingCurveSupply === 'number'">
                <div class="w-[72px] h-1.5 rounded-full bg-grey-light-active overflow-hidden">
                  <div class="h-full bg-gradient-primary rounded-full" :style="{ width: Math.min(curveProgress, 100) + '%' }" />
                </div>
                <span class="tabular-nums">{{ curveProgress.toFixed(0) }}%</span>
              </template>
              <Sparkline v-else-if="community.sparkline24h && community.sparkline24h.length > 1" :points="community.sparkline24h" />
              <span v-if="typeof community.holderCount === 'number'" class="whitespace-nowrap tabular-nums">{{ formatTokenAmount(community.holderCount) }} 👥</span>
              <span v-if="createTimeText" class="ml-auto whitespace-nowrap">{{ createTimeText }}</span>
            </div>
          </div>
          <slot name="default-btn"><div class="flex items-center" /></slot>
        </div>
        <div class="flex justify-between items-center mt-2">
          <div class="font-extralight flex flex-wrap gap-2">
            <template v-if="communityTags.length">
              <button v-for="(tag, index) of communityTags" :key="tag" class="px-2 h-5 text-xs rounded-md" :style="getTagStyle(index)">
                {{ tag }}
              </button>
            </template>
          </div>
          <IconLinks class="my-1" :community="community" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compact-token-card { min-height:76px; align-items:center; justify-content:space-between; padding:12px 14px; border:1px solid var(--border-base); border-radius:16px; background:var(--surface); cursor:pointer; transition:.18s ease; }
.compact-token-card:hover { border-color:#fe913f; box-shadow:0 8px 24px rgba(31,25,20,.06); transform:translateY(-1px); }
</style>
