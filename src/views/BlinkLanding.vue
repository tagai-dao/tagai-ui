<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveCommerce, getTweetById, type CommerceResolveResult } from '@/apis/api'
import { useChainStore } from '@/stores/chain'
import { getChainPath } from '@/config/chains'
import { verifiedBlink } from '@/utils/blinkAttribution'
import FeedTokenTradeSheet from '@/components/feed/FeedTokenTradeSheet.vue'
import BlinkTwitterLoginButton from '@/components/login/BlinkTwitterLoginButton.vue'
import { useBlinkLoginPrompt } from '@/composables/useBlinkLoginPrompt'

const route = useRoute(), router = useRouter(), chain = useChainStore()
const showBlinkLogin = useBlinkLoginPrompt()
const source = ref<CommerceResolveResult | null>(null)
const loading = ref(false), error = ref(''), trade = ref(false)
let generation = 0
onUnmounted(() => { generation++ })
async function load(checkPost = false) {
  const run = ++generation, id = String(route.params.commerceid || ''), chainId = chain.activeChainId
  source.value = null; error.value = ''; trade.value = false; loading.value = true
  try {
    const result = await resolveCommerce(id, chainId)
    if (run !== generation) return
    if (result?.c !== 0) throw new Error('Blinks unavailable. Please retry.')
    // Prediction Blinks keep their existing destination; token referral is separate.
    const data = result.d
    if ([2, 3].includes(data.commerceType) && data.fpmm) {
      await router.replace(getChainPath(chainId, `/predict/${data.commerceType === 2 ? 'battle' : 'event'}/${encodeURIComponent(data.fpmm)}`))
      return
    }
    source.value = verifiedBlink(data, id, chainId)
    if (data.tweetId && (checkPost || route.query.preview !== '1')) {
      try {
        const post: any = await getTweetById(data.tweetId)
        if (run !== generation) return
        if (String(post?.tweetId) === String(data.tweetId)) {
          await router.replace({ path: getChainPath(chainId, `/${post.spaceId ? 'space-detail' : 'post-detail'}/${encodeURIComponent(data.tweetId)}`), query: { ...route.query, blink: id } })
        }
      } catch { /* Missing/unsynced posts retain the verified publisher card. */ }
    }
  } catch (e) { if (run === generation) error.value = e instanceof Error ? e.message : 'Unable to load Blinks. Please retry.' }
  finally { if (run === generation) loading.value = false }
}
watch(() => [route.params.commerceid, chain.activeChainId], () => load(), { immediate: true })
</script>

<template>
  <section class="p-4 text-content">
    <p v-if="loading">Loading Blinks…</p>
    <div v-else-if="error" role="alert">{{ error }} <button class="text-orange-normal" @click="load()">Retry</button></div>
    <article v-else-if="source" class="rounded-2xl bg-surface border border-line p-5 space-y-4">
      <h1 class="text-xl font-semibold">{{ source.publisher.name || source.publisher.username || 'Blinks creator' }}</h1>
      <p>{{ source.publisher.username ? '@' + source.publisher.username : source.publisher.twitterId }}</p>
      <p class="text-sm">The original post is not available yet. This trade retains the verified Blinks publisher.</p>
      <a v-if="source.tweetId" :href="`https://x.com/i/status/${source.tweetId}`" target="_blank" rel="noopener noreferrer" class="text-orange-normal">View original post on X</a>
      <div class="flex gap-2 items-stretch">
        <BlinkTwitterLoginButton v-if="showBlinkLogin" :return-path="route.fullPath" />
        <button v-else class="min-w-0 flex-1 rounded-xl bg-surface-2 border border-line p-3 text-left" @click="trade = true">Trade ${{ source.tick }}</button>
      </div>
      <router-link :to="{ path: getChainPath(source.chainId, `/tag-detail/${encodeURIComponent(source.tick!)}`), query: { blink: source.commerceId } }" class="text-orange-normal">Open community · keep Blinks attribution</router-link>
      <button class="block text-sm" @click="load(true)">Check for original post again</button>
    </article>
    <FeedTokenTradeSheet v-if="source" v-model="trade" :asset="{tick: source.tick!, token: source.token!, sellsman: source.publisher.address || undefined}" />
  </section>
</template>
