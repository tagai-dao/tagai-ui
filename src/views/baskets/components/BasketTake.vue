<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { API_BASE_URL } from '@/config/api'

const props = defineProps<{ address: string; chainId: number }>()
const { locale } = useI18n()
const zh = computed(() => locale.value.toLowerCase().startsWith('zh'))
type Evidence = { url: string; fact: string; asOf: string }
type Leg = { asset: string; symbol?: string; weightBps: number; rationale: string; evidence: Evidence[] }
type Take = {
  source: { tweetId: string; text: string }
  take: { claim: string; falsifiers: string[] }
  legs: Leg[]
  creator: string
  recipient: string
}
const take = ref<Take | null>(null)
const safeUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
function valid(value: unknown): value is Take {
  if (!value || typeof value !== 'object') return false
  const v = value as Take
  return typeof v.source?.tweetId === 'string' && /^\d+$/.test(v.source.tweetId)
    && typeof v.source.text === 'string' && typeof v.take?.claim === 'string'
    && Array.isArray(v.take.falsifiers) && v.take.falsifiers.every(x => typeof x === 'string')
    && typeof v.creator === 'string' && typeof v.recipient === 'string'
    && Array.isArray(v.legs) && v.legs.length <= 8 && v.legs.every(l =>
      l && typeof l.asset === 'string' && typeof l.rationale === 'string'
      && Number.isInteger(l.weightBps) && l.weightBps >= 0 && l.weightBps <= 10000
      && Array.isArray(l.evidence) && l.evidence.every(e => e && typeof e.url === 'string'
        && typeof e.fact === 'string' && typeof e.asOf === 'string'))
}
watch(() => [props.chainId, props.address] as const, async ([chainId, address], _, onCleanup) => {
  take.value = null
  if (chainId !== 56 || !/^0x[0-9a-f]{40}$/i.test(address)) return
  const controller = new AbortController()
  let active = true
  const timeout = setTimeout(() => controller.abort(), 10000)
  onCleanup(() => { active = false; controller.abort(); clearTimeout(timeout) })
  try {
    const response = await fetch(`${API_BASE_URL}/agent/basket-takes/${address}`, {
      headers: { 'X-Chain-Id': '56' }, signal: controller.signal, credentials: 'omit',
    })
    if (!response.ok) return
    const body = await response.json()
    if (active && body.c === 0 && valid(body.d)) take.value = body.d
  } catch { /* Older APIs and ordinary baskets do not have take metadata. */ }
  finally { clearTimeout(timeout) }
}, { immediate: true })
</script>

<template>
  <section v-if="take" class="take-panel text-content">
    <h2>{{ zh ? '观点与投资组合' : 'Opinion and portfolio' }}</h2>
    <a :href="`https://x.com/i/status/${take.source.tweetId}`" target="_blank" rel="noopener noreferrer">
      {{ zh ? '查看 X 原帖' : 'View original post on X' }} ↗
    </a>
    <blockquote>{{ take.source.text }}</blockquote>
    <p>{{ take.take.claim }}</p>
    <div v-for="leg in take.legs" :key="leg.asset" class="take-leg">
      <h3>{{ leg.symbol || leg.asset }} · {{ (leg.weightBps / 100).toFixed(2) }}%</h3>
      <p>{{ leg.rationale }}</p>
      <ul>
        <li v-for="(evidence, index) in leg.evidence" :key="index">
          <a v-if="safeUrl(evidence.url)" :href="safeUrl(evidence.url)" target="_blank" rel="noopener noreferrer">
            {{ evidence.fact }} ↗
          </a>
          <span v-else>{{ evidence.fact }}</span>
          <span class="text-muted"> · {{ evidence.asOf }}</span>
        </li>
      </ul>
    </div>
    <h3>{{ zh ? '哪些情况会推翻该观点' : 'What would invalidate this thesis' }}</h3>
    <ul><li v-for="(reason, index) in take.take.falsifiers" :key="index">{{ reason }}</li></ul>
    <p class="text-muted">{{ zh ? '权重表示观点匹配度，不代表收益预测；本组合不会自动再平衡。' : 'Weights reflect thesis alignment, not return forecasts. This basket does not rebalance automatically.' }}</p>
    <p class="text-muted">{{ zh ? '链上创建者' : 'On-chain creator' }}: {{ take.creator }}<br>
      {{ zh ? '首购份额接收者' : 'Initial share recipient' }}: {{ take.recipient }}</p>
  </section>
</template>

<style scoped>
.take-panel { padding: 1.5rem; border: 1px solid rgb(128 128 128 / 20%); border-radius: 1rem; margin: 1.5rem 0; overflow-wrap: anywhere; }
h2 { font-size: 1.2rem; font-weight: 600; margin-bottom: .75rem; }
h3 { font-weight: 600; margin: 1rem 0 .5rem; }
p, blockquote { margin: .75rem 0; white-space: pre-wrap; }
blockquote { padding-left: 1rem; border-left: 3px solid rgb(128 128 128 / 35%); }
a { text-decoration: underline; text-underline-offset: 3px; }
ul { list-style: disc; padding-left: 1.25rem; }
li { margin: .5rem 0; }
.take-leg { border-top: 1px solid rgb(128 128 128 / 15%); margin-top: 1rem; }
</style>
