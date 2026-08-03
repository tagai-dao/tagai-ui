<script setup lang="ts">
import { computed } from 'vue'
import { useChainStore } from '@/stores/chain'
import { getBasketDeployment, isBasketChain } from '@/config/baskets'

const chainStore = useChainStore()
const hasRouter = computed(() => isBasketChain(chainStore.activeChainId) &&
  !!getBasketDeployment(chainStore.activeChainId).contracts.swapRouter)
</script>

<template>
  <div
    v-if="!hasRouter"
    class="mb-4 rounded-lg border border-red-normal/30 bg-red-normal/5 px-4 py-3 text-sm text-content"
  >
    {{ $t('baskets.configMissing') }}
  </div>
</template>
