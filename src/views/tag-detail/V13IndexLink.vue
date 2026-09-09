<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAddress, zeroAddress, type Address, type Abi } from 'viem'
import { useCommunityStore } from '@/stores/community'
import { getV13Detail } from '@/utils/v13/pools'
import { getReadOnlyClient } from '@/utils/wallets'
import tokenAbi from '@/utils/v13/Token13.json'

const { t } = useI18n()
const store = useCommunityStore()
const token = computed(() => store.currentSelectedCommunity?.token)
const name = ref(''), address = ref('')
let request = 0, loading = false
async function refresh() {
  if (!token.value || !isAddress(token.value)) return
  const id = ++request
  loading = true
  const [detail, index] = await Promise.allSettled([
    getV13Detail(token.value as Address),
    getReadOnlyClient(56).readContract({ address: token.value as Address, abi: tokenAbi as Abi, functionName: 'indexToken' }),
  ])
  if (id !== request) return
  loading = false
  if (detail.status === 'fulfilled') name.value = detail.value.config.name || detail.value.config.symbol
  const candidate = index.status === 'fulfilled' ? String(index.value)
    : detail.status === 'fulfilled' ? detail.value.config.index_token : address.value
  address.value = candidate && isAddress(candidate) && candidate.toLowerCase() !== zeroAddress ? candidate : ''
}
watch(token, () => {
  request++; name.value = ''; address.value = ''; loading = false
  void refresh()
}, { immediate: true })
const timer = setInterval(() => { if (!loading && (!address.value || !name.value)) void refresh() }, 15000)
onUnmounted(() => { request++; clearInterval(timer) })
</script>

<template>
  <div class="flex justify-between items-center min-h-6 gap-3">
    <span class="text-h4 text-grey-93 shrink-0">{{ t('v13Page.linkedIndex') }}</span>
    <RouterLink v-if="address" :to="`/bsc/baskets/${address}`" class="text-h5 text-orange-normal underline truncate" :title="name || address">{{ name || `${address.slice(0, 6)}…${address.slice(-4)}` }}</RouterLink>
    <span v-else class="text-h5 text-grey-93 truncate" :title="t('v13Page.indexDelay')">{{ name || '—' }}</span>
  </div>
</template>
