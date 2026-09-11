<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTokenFavoritesStore } from '@/stores/tokenFavorites'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import type { FavoriteToken } from '@/apis/tokenFavorites'
import CommunityLogo from '@/components/common/CommunityLogo.vue'
import BasketTokenLogo from '@/views/baskets/components/BasketTokenLogo.vue'
import TokenFavoriteButton from '@/components/common/TokenFavoriteButton.vue'
import { getChainPath } from '@/config/chains'

const favorites = useTokenFavoritesStore()
const chain = useChainStore()
const router = useRouter()
const refreshing = ref(false)
async function load(force = false) {
  try { await favorites.load(force) } catch { /* Render retry state below. */ }
  finally { refreshing.value = false }
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
        <article v-for="token in favorites.entries" :key="`${token.chainId}:${token.address}`"
          class="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3">
          <TokenFavoriteButton :token="token" :kind="token.kind" />
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="open(token)">
            <BasketTokenLogo v-if="token.kind === 'basket'" :chain-id="token.chainId" :address="token.address" :symbol="token.symbol" :size="40" />
            <CommunityLogo v-else :logo="token.logo" size="md" :shadow="false" />
            <span class="min-w-0">
              <strong class="block truncate text-content">{{ token.name || token.symbol }}</strong>
              <span class="block truncate text-sm text-muted">{{ token.symbol }} <span v-if="token.kind === 'basket'">· {{ $t('baskets.menu') }}</span></span>
              <span class="block text-xs text-muted">{{ token.address.slice(0, 6) }}…{{ token.address.slice(-4) }}</span>
            </span>
          </button>
        </article>
      </div>
    </van-pull-refresh>
  </div>
</template>
