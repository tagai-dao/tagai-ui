<script setup lang="ts">
import { computed } from 'vue'
import BasketAssetLogo from './BasketAssetLogo.vue'

type BasketLogoAsset = { address: string; symbol: string; weightPct?: number; targetWeightPct?: number }

const props = withDefaults(defineProps<{
  chainId: number
  address: string
  symbol: string
  assets?: BasketLogoAsset[]
  size?: number
}>(), { assets: () => [], size: 58 })

const visibleAssets = computed(() => [...props.assets]
  .sort((a, b) => Number(b.weightPct ?? b.targetWeightPct ?? 0) - Number(a.weightPct ?? a.targetWeightPct ?? 0))
  .slice(0, 3))
const fallback = computed(() => props.symbol.replace(/^\$/, '').slice(0, 2).toUpperCase())
</script>

<template>
  <span
    class="basket-token-logo"
    :class="`basket-token-logo--${Math.max(visibleAssets.length, 1)}`"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="symbol"
    role="img"
    :aria-label="`${symbol} logo`"
  >
    <template v-if="visibleAssets.length">
      <BasketAssetLogo
        v-for="asset in visibleAssets"
        :key="asset.address"
        class="basket-token-logo__asset"
        :chain-id="chainId"
        :address="asset.address"
        :symbol="asset.symbol"
        :size="size"
      />
    </template>
    <b v-else>{{ fallback }}</b>
  </span>
</template>

<style scoped>
.basket-token-logo {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  overflow: visible;
  border: 2px solid color-mix(in srgb, var(--surface) 82%, white 18%);
  border-radius: 50%;
  background: linear-gradient(145deg, #ff9b4a, #8d67e8 52%, #27b8a2);
  box-shadow: 0 10px 28px rgba(22, 24, 38, .18), 0 0 0 1px color-mix(in srgb, var(--border-base) 72%, transparent);
}
.basket-token-logo > b { display: grid; width: 100%; height: 100%; place-items: center; color: white; font-size: 28%; font-weight: 900; }
.basket-token-logo__asset { position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; box-shadow: none; }
.basket-token-logo__asset:nth-child(n + 2) {
  top: auto;
  right: -4%;
  bottom: -4%;
  left: auto;
  width: 48% !important;
  height: 48% !important;
  border: 2px solid var(--surface);
  box-shadow: 0 3px 9px rgba(10, 12, 20, .2);
}
.basket-token-logo__asset:nth-child(3) { right: 31%; width: 40% !important; height: 40% !important; }
</style>
