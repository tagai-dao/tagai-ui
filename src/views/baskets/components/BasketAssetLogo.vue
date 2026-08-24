<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveBasketAssetLogo } from '@/utils/baskets/logos'

const props = withDefaults(defineProps<{
  chainId: number
  address: string
  symbol: string
  size?: number
}>(), { size: 40 })

const imageUrl = ref<string | null>(null)
const imageFailed = ref(false)
let requestId = 0

const initials = computed(() => props.symbol.trim().replace(/^\$/, '').slice(0, 2).toUpperCase() || '?')
const colorSeed = computed(() => {
  let value = 0
  for (const character of `${props.address}${props.symbol}`) value = ((value << 5) - value + character.charCodeAt(0)) | 0
  const hue = Math.abs(value) % 360
  return {
    background: `linear-gradient(145deg, hsl(${hue} 70% 58%), hsl(${(hue + 48) % 360} 62% 38%))`,
  }
})

watch(
  () => [props.chainId, props.address] as const,
  async () => {
    const current = ++requestId
    imageFailed.value = false
    imageUrl.value = null
    const resolved = await resolveBasketAssetLogo(props.chainId, props.address)
    if (current === requestId) imageUrl.value = resolved
  },
  { immediate: true },
)
</script>

<template>
  <span
    class="asset-logo"
    :style="{ width: `${size}px`, height: `${size}px`, ...colorSeed }"
    :title="symbol"
    aria-hidden="true"
  >
    <img
      v-if="imageUrl && !imageFailed"
      :src="imageUrl"
      :alt="symbol"
      referrerpolicy="no-referrer"
      @error="imageFailed = true"
    >
    <b v-else>{{ initials }}</b>
  </span>
</template>

<style scoped>
.asset-logo {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border-base) 78%, white 22%);
  border-radius: 50%;
  box-shadow: 0 5px 16px rgba(16, 18, 28, .14);
  color: white;
}
.asset-logo img { width: 100%; height: 100%; object-fit: cover; }
.asset-logo b { font-size: 32%; font-weight: 900; letter-spacing: -.04em; text-shadow: 0 1px 3px rgba(0, 0, 0, .25); }
</style>
