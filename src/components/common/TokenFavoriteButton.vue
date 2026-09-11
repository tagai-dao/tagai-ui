<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTokenFavoritesStore } from '@/stores/tokenFavorites'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import type { FavoriteToken } from '@/apis/tokenFavorites'
import { notify } from '@/utils/notify'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  token?: { token?: string; address?: string; name?: string; tick?: string; symbol?: string; logo?: string | null; chainId?: number | null } | null
  kind?: FavoriteToken['kind']
}>()
const favorites = useTokenFavoritesStore()
const { t } = useI18n()
const chain = useChainStore()
const address = computed(() => props.token?.address || props.token?.token || '')
const selected = computed(() => favorites.contains(address.value))
const busy = computed(() => favorites.loading || favorites.isPending(address.value))
watch([() => favorites.accountId, () => chain.activeChainId, address], () => {
  if (address.value) void favorites.load().catch(() => { /* Clicking retries and reports failures. */ })
}, { immediate: true })

async function toggle() {
  if (!favorites.accountId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return
  }
  try {
    await favorites.toggle({
      chainId: props.token?.chainId || chain.activeChainId,
      address: address.value,
      kind: props.kind || 'community',
      name: props.token?.name || props.token?.tick || props.token?.symbol || '',
      symbol: props.token?.tick || props.token?.symbol || '',
      logo: props.token?.logo || '',
    })
  } catch { notify({ message: t('watchlist.saveError'), type: 'error' }) }
}
</script>

<template>
  <button v-if="address" type="button" class="token-favorite" :class="{ selected }"
    :disabled="busy" :aria-busy="busy" :aria-pressed="selected"
    :aria-label="$t(selected ? 'watchlist.remove' : 'watchlist.add')"
    :title="$t(selected ? 'watchlist.remove' : 'watchlist.add')" @click.stop="toggle">
    <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true">
      <path d="m12 2.6 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.41l-5.8 3.06 1.1-6.47-4.7-4.58 6.5-.94L12 2.6Z" />
    </svg>
  </button>
</template>

<style scoped>
.token-favorite { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0; color: var(--text-muted, #787f82); border-radius: 10px; transition: color .15s, background .15s; }
.token-favorite.selected { color: #e9bd58; }
.token-favorite:hover { background: rgba(233, 189, 88, .1); }
.token-favorite:focus-visible { outline: 2px solid #e9bd58; outline-offset: 2px; }
.token-favorite:disabled { cursor: wait; opacity: .55; }
</style>
