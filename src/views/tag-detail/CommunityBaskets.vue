<script setup lang="ts">
import { ref, watch } from 'vue'
import BasketCard from '@/views/baskets/components/BasketCard.vue'
import { listBaskets } from '@/utils/baskets/data'
import type { BasketSummary } from '@/utils/baskets/types'
import { useChainStore } from '@/stores/chain'

const props = defineProps<{
  token?: string
  tick?: string
}>()

const chainStore = useChainStore()
const baskets = ref<BasketSummary[]>([])
const loading = ref(false)
const error = ref('')
let requestSequence = 0

const matchingBaskets = (rows: BasketSummary[], token: string) => {
  const normalizedToken = token.toLowerCase()
  return rows
    .filter((basket) => basket.top.some((asset) => asset.address.toLowerCase() === normalizedToken))
    .sort((left, right) => (right.aumUsd || 0) - (left.aumUsd || 0))
}

const load = async () => {
  const sequence = ++requestSequence
  const token = props.token
  baskets.value = []
  error.value = ''
  if (!token) return
  loading.value = true
  try {
    const rows = await listBaskets(chainStore.activeChainId, {
      onShell: (shell) => {
        if (sequence !== requestSequence) return
        baskets.value = matchingBaskets(shell, token)
      },
    })
    if (sequence !== requestSequence) return
    baskets.value = matchingBaskets(rows, token)
  } catch (cause) {
    if (sequence !== requestSequence) return
    error.value = cause instanceof Error ? cause.message : 'Failed to load baskets'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

watch(
  [() => chainStore.activeChainId, () => props.token],
  () => { void load() },
  { immediate: true },
)
</script>

<template>
  <section class="community-baskets">
    <header class="community-baskets__header">
      <div>
        <span>{{ $t('baskets.communityEyebrow') }}</span>
        <h2>{{ $t('baskets.communityTitle', { token: tick || 'Token' }) }}</h2>
      </div>
      <strong v-if="baskets.length">{{ baskets.length }}</strong>
    </header>

    <div v-if="loading && baskets.length === 0" class="community-baskets__state">
      <span class="community-baskets__loader" />
      {{ $t('baskets.loading') }}
    </div>
    <div v-else-if="error && baskets.length === 0" class="community-baskets__state community-baskets__state--error">
      {{ $t('baskets.communityLoadFailed') }}
    </div>
    <div v-else-if="baskets.length === 0" class="community-baskets__state">
      {{ $t('baskets.communityEmpty', { token: tick || 'token' }) }}
    </div>
    <div v-else class="community-baskets__grid">
      <BasketCard v-for="basket in baskets" :key="basket.address" :basket="basket" />
    </div>
  </section>
</template>

<style scoped>
.community-baskets { min-height: 100%; padding: 4px 0 24px; }
.community-baskets__header {
  display: flex; align-items: end; justify-content: space-between; gap: 16px;
  margin-bottom: 16px; padding: 4px 4px 0;
}
.community-baskets__header span {
  color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
}
.community-baskets__header h2 { margin-top: 4px; color: var(--text-base); font-size: 20px; font-weight: 750; }
.community-baskets__header strong {
  display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--border-base);
  border-radius: 999px; background: var(--surface-2); color: var(--text-muted); font-size: 12px;
}
.community-baskets__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.community-baskets__state {
  display: flex; min-height: 180px; align-items: center; justify-content: center; gap: 10px;
  border: 1px dashed var(--border-base); border-radius: 20px; background: var(--surface-2);
  color: var(--text-muted); font-size: 13px; text-align: center;
}
.community-baskets__state--error { color: var(--color-red, #ef596f); }
.community-baskets__loader {
  width: 16px; height: 16px; border: 2px solid color-mix(in srgb, var(--text-muted) 25%, transparent);
  border-top-color: var(--text-muted); border-radius: 999px; animation: community-baskets-spin .8s linear infinite;
}
@keyframes community-baskets-spin { to { transform: rotate(360deg); } }
@media (min-width: 1200px) {
  .community-baskets__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
