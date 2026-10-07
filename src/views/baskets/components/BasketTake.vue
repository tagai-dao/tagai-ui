<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TakeDetailPopover from './TakeDetailPopover.vue'
import { API_BASE_URL } from '@/config/api'

const props = defineProps<{ address: string; chainId: number }>()
const { locale } = useI18n()
const zh = computed(() => locale.value.toLowerCase().startsWith('zh'))
type Evidence = { url: string; fact: string; asOf: string }
type Leg = { asset: string; symbol?: string; weightBps: number; rationale: string; evidence: Evidence[] }
type Take = {
  source: { tweetId: string; text: string }
  take: { claim: string; falsifiers: string[]; thesisSource?: string }
  legs: Leg[]
  creator: string
  recipient: string
}
const take = ref<Take | null>(null)
const expanded = ref(false)
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
  expanded.value = false
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
    <button class="take-toggle" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span>{{ zh ? '观点与投资组合' : 'Opinion and portfolio' }}</span>
      <svg class="take-chevron" :class="{ expanded }" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div v-if="expanded" class="take-body">
      <h3>{{ zh ? '投资观点' : 'The idea' }}</h3>
      <p class="take-claim">{{ take.take.claim }}</p>
      <p v-if="take.take.thesisSource === 'agent-research'" class="take-note text-muted">
        {{ zh ? 'Agent 根据原帖调研形成，未经发帖者确认。' : 'Developed by the Agent from the original research request; not confirmed by its author.' }}
      </p>
      <TakeDetailPopover :label="zh ? 'X 原帖' : 'Original X post'">
        <blockquote>{{ take.source.text }}</blockquote>
        <a :href="`https://x.com/i/status/${take.source.tweetId}`" target="_blank" rel="noopener noreferrer">
          {{ zh ? '查看 X 原帖' : 'View original post on X' }} ↗
        </a>
      </TakeDetailPopover>
      <h3>{{ zh ? '持仓成分' : 'What it owns' }}</h3>
      <ul class="take-holdings">
        <li v-for="leg in take.legs" :key="leg.asset" class="take-leg">
          <TakeDetailPopover :label="leg.symbol || leg.asset">
            <h4>{{ leg.symbol || leg.asset }} · {{ (leg.weightBps / 100).toFixed(2) }}%</h4>
            <p>{{ leg.rationale }}</p>
            <ul class="take-evidence">
              <li v-for="(evidence, index) in leg.evidence" :key="index">
                <a v-if="safeUrl(evidence.url)" :href="safeUrl(evidence.url)" target="_blank" rel="noopener noreferrer">{{ evidence.fact }} ↗</a>
                <span v-else>{{ evidence.fact }}</span>
                <span class="text-muted"> · {{ evidence.asOf }}</span>
              </li>
            </ul>
          </TakeDetailPopover>
          <span class="take-weight">{{ (leg.weightBps / 100).toFixed(2) }}%</span>
        </li>
      </ul>
      <div class="take-details">
        <TakeDetailPopover v-if="take.take.falsifiers.length" :label="zh ? '观点失效条件' : 'What could change the idea'">
          <ul class="take-evidence"><li v-for="(reason, index) in take.take.falsifiers" :key="index">{{ reason }}</li></ul>
        </TakeDetailPopover>
        <TakeDetailPopover :label="zh ? '创建信息' : 'Creation details'">
          <p>{{ zh ? '链上创建者' : 'On-chain creator' }}: {{ take.creator }}</p>
          <p>{{ zh ? '首购份额接收者' : 'Initial share recipient' }}: {{ take.recipient }}</p>
        </TakeDetailPopover>
      </div>
      <p class="take-note text-muted">{{ zh ? '权重表示观点匹配度，不代表收益预测；本组合不会自动再平衡。' : 'Weights reflect thesis alignment, not return forecasts. This basket does not rebalance automatically.' }}</p>
    </div>
  </section>
</template>

<style scoped>
.take-panel { border: 1px solid rgb(128 128 128 / 20%); border-radius: 1rem; margin: 1.5rem 0; overflow-wrap: anywhere; }
.take-toggle { display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%; padding: 1.25rem 1.5rem; text-align: left; font-size: 1rem; font-weight: 600; color: inherit; }
.take-toggle:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; border-radius: 1rem; }
.take-chevron { flex-shrink: 0; transition: transform .18s ease; }
.take-chevron.expanded { transform: rotate(180deg); }
.take-body { padding: 0 1.5rem 1.5rem; }
h3 { font-family: Georgia, 'Times New Roman', serif; font-size: 1.3rem; font-weight: 500; line-height: 1.35; margin: 1.75rem 0 .8rem; }
h3:first-child { margin-top: .25rem; }
h4 { font-weight: 600; margin-bottom: .5rem; }
.take-claim { font-size: .9375rem; line-height: 1.75; white-space: pre-wrap; margin-bottom: .75rem; }
p, blockquote { white-space: pre-wrap; }
blockquote { margin-bottom: .75rem; }
a { text-decoration: underline; text-underline-offset: 3px; }
.take-holdings { list-style: none; padding: 0; margin: 0; }
.take-leg { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: .65rem 0; border-bottom: 1px solid rgb(128 128 128 / 12%); font-size: .9375rem; }
.take-weight { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.take-evidence { list-style: disc; padding-left: 1.1rem; margin-top: .75rem; }
.take-evidence li { margin: .5rem 0; }
.take-details { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; margin-top: 1.25rem; }
.take-note { font-size: .75rem; line-height: 1.65; margin: .75rem 0 0; }
@media (max-width: 640px) { .take-toggle { padding: 1rem; } .take-body { padding: 0 1rem 1rem; } }
@media (prefers-reduced-motion: reduce) { .take-chevron { transition: none; } }
</style>
