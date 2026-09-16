<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChainStore } from '@/stores/chain'
import { resolveCommerce, type CommerceResolveResult } from '@/apis/api'
import { verifiedBlink, blinkIdFromRoute } from '@/utils/blinkAttribution'
import { getChainPath } from '@/config/chains'
const route = useRoute(), chain = useChainStore()
const source = ref<CommerceResolveResult | null>(null)
let run = 0
watch(() => [route.fullPath, chain.activeChainId], async () => {
  const current = ++run
  source.value = null
  try {
    const id = blinkIdFromRoute(route)
    if (!id || route.name === 'commerce') return
    const chainId = chain.activeChainId
    const result = await resolveCommerce(id, chainId)
    if (run !== current || result?.c !== 0) return
    const verified = verifiedBlink(result.d, id, chainId)
    if (['tag-detail','buy-sell'].includes(String(route.name)) && route.params.id !== verified.tick) return
    if (['post-detail','space-detail'].includes(String(route.name)) && String(route.params.id) !== String(verified.tweetId)) return
    source.value = verified
  } catch { /* Trade confirmation independently fails closed if verification fails. */ }
}, { immediate: true })
</script>
<template>
  <aside v-if="source" class="fixed top-16 left-3 right-3 web:left-64 web:right-auto z-[1000] rounded-lg border border-line bg-surface px-3 py-2 text-xs text-content shadow">
    From {{ source.publisher.username ? '@' + source.publisher.username : source.publisher.name || source.publisher.twitterId }} · Blinks
    <router-link class="ml-2 text-orange-normal" :to="{path:getChainPath(source.chainId, `/commerce/${encodeURIComponent(source.commerceId)}`),query:{preview:'1'}}">View source</router-link>
  </aside>
</template>
