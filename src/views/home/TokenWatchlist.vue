<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTokenFavoritesStore } from '@/stores/tokenFavorites'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType, type Community } from '@/types'
import type { FavoriteToken } from '@/apis/tokenFavorites'
import TagListItem from '@/components/home/TagListItem.vue'
import BasketTokenLogo from '@/views/baskets/components/BasketTokenLogo.vue'
import TokenFavoriteButton from '@/components/common/TokenFavoriteButton.vue'
import { getChainPath } from '@/config/chains'
import { useWatchlistMetrics } from '@/composables/useWatchlistMetrics'

const favorites = useTokenFavoritesStore()
const chain = useChainStore()
const router = useRouter()
const refreshing = ref(false)
const { values: metricValues, communities, prices, refresh: refreshMetrics } = useWatchlistMetrics()
async function load(force = false) {
  try {
    await favorites.load(force)
    await refreshMetrics(force)
  } catch { /* Render retry state below. */ }
  finally { refreshing.value = false }
}
function cardCommunity(token: FavoriteToken): Community {
  return communities.value[token.address.toLowerCase()] || {
    token: token.address, chainId: token.chainId, tick: token.symbol,
    name: token.name || token.symbol, logo: token.logo, description: token.name || token.symbol,
  } as Community
}
function open(token: FavoriteToken) {
  const path = token.kind === 'basket' ? `/baskets/${token.address}` : `/tag-detail/${encodeURIComponent(token.symbol)}`
  void router.push(getChainPath(chain.activeChainId, path))
}
watch([() => favorites.accountId, () => chain.activeChainId], () => void load())
onMounted(() => void load())
onActivated(() => void load())
</script>

<template>
  <div class="flex-1 min-h-0 px-3 mobile-scroll-container no-scroll-bar">
    <div v-if="!favorites.accountId" class="flex flex-col items-center gap-4 py-16 text-muted">
      <p>{{ $t('watchlist.loginHint') }}</p>
      <button type="button" class="rounded-full bg-orange-normal px-6 py-2 text-white"
        @click="useModalStore().setModalVisible(true, GlobalModalType.Login)">{{ $t('login') }}</button>
    </div>
    <van-pull-refresh v-else v-model="refreshing" class="min-h-full web:max-w-[1240px] web:mx-auto" @refresh="load(true)">
      <div v-if="favorites.failed" role="alert" class="flex items-center justify-center gap-3 py-6 text-muted">
        <span>{{ $t('watchlist.loadError') }}</span>
        <button type="button" class="text-orange-normal" @click="load(true)">{{ $t('watchlist.retry') }}</button>
      </div>
      <div v-if="favorites.loading && !favorites.loaded" role="status" class="flex justify-center gap-2 py-12">
        <i-ep-loading class="animate-spin w-6 h-6 text-orange-normal" />{{ $t('loading') }}
      </div>
      <div v-else-if="favorites.loaded && !favorites.entries.length && !favorites.failed" class="flex flex-col items-center gap-4 py-12 text-muted">
        <img src="~@/assets/images/empty-data.svg" alt="">
        <p>{{ $t('watchlist.empty') }}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
        <TagListItem v-for="token in favorites.entries" :key="`${token.chainId}:${token.address}`"
          :community="cardCommunity(token)"
          :market-cap-usd="metricValues[token.address.toLowerCase()] || 0"
          :price-usd="(token.kind === 'basket' ? metricValues : prices)[token.address.toLowerCase()] || 0"
          :metric-label="token.kind === 'basket' ? 'NAV' : undefined"
          @click="open(token)" @keydown.enter.prevent="open(token)">
          <template v-if="token.kind === 'basket'" #logo="{ size }">
            <BasketTokenLogo :chain-id="token.chainId" :address="token.address" :symbol="token.symbol" :size="size" />
          </template>
          <template #logo-badge><TokenFavoriteButton :token="token" :kind="token.kind" badge /></template>
        </TagListItem>
      </div>
    </van-pull-refresh>
  </div>
</template>
