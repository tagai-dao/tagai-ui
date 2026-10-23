<script setup lang="ts">
import { computed } from 'vue'
import { externalSourceLogos } from '@/assets/externalSourceLogos'
import { holderDisplayName, holderDisplayOrigin, type HolderIdentity } from '@/utils/holderIdentity'

const props = defineProps<{ holder: HolderIdentity }>()
const name = computed(() => holderDisplayName(props.holder))
const origin = computed(() => holderDisplayOrigin(props.holder))
const labels = { BINANCE: 'Binance Agent ID', X: 'X account', TAGAI: 'TagAI account' }
</script>

<template>
  <span class="inline-flex max-w-full min-w-0 items-center gap-1" :title="holder.ethAddr">
    <span class="min-w-0 break-all">{{ name }}</span>
    <img v-if="origin" :src="externalSourceLogos[origin]" :alt="labels[origin]" :title="labels[origin]"
         class="holder-identity-icon" />
  </span>
</template>

<style scoped>
.holder-identity-icon { width: 16px; height: 16px; flex-shrink: 0; object-fit: contain;
  padding: 1px; border: 1px solid rgb(0 0 0 / 10%); border-radius: 9999px; background: #fff; }
</style>
