<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useBasketList } from '@/composables/baskets/useBasketList'
import BasketChainGate from './components/BasketChainGate.vue'
import BasketCard from './components/BasketCard.vue'
import CreateBasketModal from './components/CreateBasketModal.vue'
import { getBasketDeployment } from '@/config/baskets'
import { getChainDeployment } from '@/config/chains'
import { useChainStore } from '@/stores/chain'

const {
  baskets,
  isLoading,
  hasError,
  errorMessage,
  searchQuery,
  filteredBaskets,
  refresh,
} = useBasketList()

const list = computed(() => [...filteredBaskets()].sort((a, b) => {
  const aumA = Number.isFinite(a.aumUsd) ? a.aumUsd : 0
  const aumB = Number.isFinite(b.aumUsd) ? b.aumUsd : 0
  return aumB - aumA
}))
const chainStore = useChainStore()
const deployment = computed(() => getBasketDeployment(chainStore.activeChainId))
const totalAum = computed(() => baskets.value.reduce((sum, basket) => sum + (basket.aumUsd || 0), 0))
const showCreate = ref(false)
const factory = computed(() => deployment.value.contracts.hook)
const factoryUrl = computed(() => `${getChainDeployment(chainStore.activeChainId).browser.replace(/\/$/, '')}/address/${factory.value}`)

const formatUsd = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="baskets-page">
    <div class="baskets-shell">
      <header class="hero">
        <div class="hero__grid" aria-hidden="true" />
        <div class="relative z-10 flex flex-col web:flex-row web:items-end web:justify-between gap-6">
          <div class="max-w-xl">
            <div class="live-badge"><i /> {{ deployment.networkLabel }} · LIVE</div>
            <h1 class="mt-4 text-[34px] web:text-[48px] leading-none font-bold tracking-[-0.055em] text-content">
              {{ $t('baskets.title') }}
            </h1>
            <p class="mt-3 max-w-md text-sm web:text-base leading-6 text-muted">
              {{ $t('baskets.subtitle', { network: deployment.networkLabel }) }}
            </p>
          </div>

          <div class="hero__stats">
            <div>
              <span>{{ $t('baskets.title') }}</span>
              <strong>{{ baskets.length || '—' }}</strong>
            </div>
            <div>
              <span>{{ $t('baskets.aum') }}</span>
              <strong>{{ formatUsd(totalAum) }}</strong>
            </div>
          </div>
        </div>
      </header>

      <BasketChainGate />

      <div class="toolbar">
        <label class="search-field">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="5.75" stroke="currentColor" stroke-width="1.5" />
            <path d="m13.25 13.25 3.25 3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="$t('baskets.searchPlaceholder')"
          >
        </label>
        <button type="button" class="create-button" @click="showCreate = true">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
          <span>{{ $t('baskets.create') }}</span>
        </button>
        <button
          type="button"
          class="refresh-button"
          :disabled="isLoading"
          @click="refresh(true)"
        >
          <svg viewBox="0 0 20 20" fill="none" :class="{ 'animate-spin': isLoading }" aria-hidden="true">
            <path d="M15.9 8a6.25 6.25 0 1 0 .1 3.6M16 4.5V8h-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ $t('baskets.refresh') }}</span>
        </button>
      </div>

      <div v-if="isLoading && list.length === 0" class="empty-state">
        <span class="loading-orbit" />
        {{ $t('baskets.loading') }}
      </div>
      <div v-else-if="hasError && list.length === 0" class="empty-state text-red-normal">
        {{ errorMessage || $t('baskets.loadFailed') }}
      </div>
      <div v-else-if="list.length === 0" class="empty-state">
        {{ $t('baskets.empty') }}
      </div>
      <div v-else class="basket-grid">
        <BasketCard v-for="b in list" :key="b.address" :basket="b" />
      </div>

      <p class="mt-10 pb-2 text-center text-xs text-muted">
        <a v-if="deployment.protocolRepo" :href="deployment.protocolRepo" target="_blank" rel="noopener noreferrer" class="hover:text-content transition-colors">
          {{ $t('baskets.openSourceProtocol') }}
        </a>
        <template v-if="factory">
          <span class="mx-2 opacity-40">·</span>
          <a :href="factoryUrl" target="_blank" rel="noopener noreferrer" class="hover:text-content transition-colors">
            {{ $t('baskets.verifyFactory') }}
          </a>
        </template>
      </p>
      <CreateBasketModal v-model="showCreate" @created="refresh(true)" />
    </div>
  </div>
</template>

<style scoped>
.baskets-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at 14% 0%, rgba(133, 75, 225, 0.07), transparent 26rem),
    radial-gradient(circle at 94% 22%, rgba(24, 185, 181, 0.06), transparent 24rem);
}

.baskets-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: 24px 16px 40px; }

.hero {
  position: relative;
  overflow: hidden;
  margin-bottom: 18px;
  padding: 30px;
  border: 1px solid var(--border-base);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}

.hero::after {
  content: '';
  position: absolute;
  right: -90px;
  top: -115px;
  width: 330px;
  height: 330px;
  border-radius: 50%;
  background: conic-gradient(from 70deg, rgba(23,184,213,.24), rgba(112,76,232,.2), rgba(197,75,183,.18), rgba(23,184,213,.24));
  filter: blur(28px);
  opacity: .58;
}

.hero__grid {
  position: absolute;
  inset: 0;
  opacity: .06;
  background-image: linear-gradient(var(--text-base) 1px, transparent 1px), linear-gradient(90deg, var(--text-base) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to right, transparent, #000 70%);
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .15em;
}

.live-badge i { width: 7px; height: 7px; border-radius: 50%; background: #42ce85; box-shadow: 0 0 10px #42ce85; }

.hero__stats { display: flex; gap: 10px; }
.hero__stats > div {
  display: flex;
  min-width: 110px;
  flex-direction: column;
  gap: 3px;
  padding: 13px 16px;
  border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-2) 72%, transparent);
}
.hero__stats span { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
.hero__stats strong { color: var(--text-base); font-size: 18px; line-height: 24px; }

.toolbar { display: flex; gap: 10px; margin: 18px 0; }
.search-field {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 15px;
  border: 1px solid var(--border-base);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text-muted);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.search-field:focus-within { border-color: #8d67e8; box-shadow: 0 0 0 3px rgba(141,103,232,.1); }
.search-field svg, .refresh-button svg, .create-button svg { width: 18px; height: 18px; flex-shrink: 0; }
.search-field input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 13px; }
.search-field input::placeholder { color: var(--text-faint); }

.refresh-button, .create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  padding: 0 16px;
  border: 1px solid var(--border-base);
  border-radius: 15px;
  background: var(--surface);
  color: var(--text-base);
  font-size: 12px;
  font-weight: 650;
  transition: background 160ms ease, transform 160ms ease;
}
.create-button { border-color: rgba(141,103,232,.28); background: rgba(141,103,232,.08); color: #8060dc; font-weight: 700; }
.refresh-button:hover:not(:disabled), .create-button:hover:not(:disabled) { background: var(--surface-2); transform: translateY(-1px); }
.refresh-button:disabled { opacity: .6; cursor: wait; }

.basket-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.empty-state { display: flex; min-height: 260px; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
.loading-orbit { width: 20px; height: 20px; border: 2px solid var(--border-base); border-top-color: #8d67e8; border-radius: 50%; animation: spin 750ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .basket-grid { grid-template-columns: 1fr; } }
@media (max-width: 803px) {
  .baskets-shell { padding-top: 14px; padding-bottom: 88px; }
  .hero { padding: 24px 20px; border-radius: 24px; }
}
@media (max-width: 460px) {
  .hero__stats { width: 100%; }
  .hero__stats > div { min-width: 0; flex: 1; }
  .refresh-button { width: 46px; padding: 0; }
  .refresh-button span { display: none; }
  .create-button { padding: 0 13px; }
}
</style>
