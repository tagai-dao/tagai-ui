<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'
import { formatUnits, isAddress, zeroAddress, type Address } from 'viem'
import { useChainStore } from '@/stores/chain'
import { quoteAgentCurveBuy } from '@/utils/agentCurveQuote'
import { AGENT_QUOTE_TTL, agentBuyAmount, agentConfidence, agentCallout, buildAgentTradePrompt, type AgentBuyEstimate } from '@/utils/agentTradePrompt'

const props = defineProps<{ token: string; tick: string; name?: string; version: number; referralAddress?: string | null }>()
const chainStore = useChainStore()
const { locale } = useI18n()
const zh = computed(() => String(locale.value).startsWith('zh'))
const { copy, copied, isSupported } = useClipboard({ legacy: true })
const installCommand = 'npx skills add https://tagclaw.com --skill tagclaw-onchain'
const amount = ref(''), confidence = ref(''), callout = ref('')
const estimate = shallowRef<AgentBuyEstimate | null>(null)
const loading = ref(false), copying = ref(false), quoteError = ref(''), copyError = ref(false)
const lastCopied = ref<'prompt' | 'install' | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined, sequence = 0, disposed = false
const contextKey = computed(() => [chainStore.activeChainId, props.token.toLowerCase(), props.version, props.referralAddress || ''].join(':'))
const draft = () => ({ token: props.token, tick: props.tick, name: props.name, amount: amount.value,
  confidence: confidence.value, callout: callout.value, referralAddress: props.referralAddress, zh: zh.value })
const validationError = computed(() => {
  try {
    if (amount.value) agentBuyAmount(amount.value)
    agentConfidence(confidence.value); agentCallout(callout.value)
    if (props.referralAddress && (!isAddress(props.referralAddress) || props.referralAddress.toLowerCase() === zeroAddress)) return 'INVALID_REFERRAL'
    return ''
  } catch (e) { return (e as Error).message }
})
const errorLabel = computed(() => {
  const error = validationError.value || quoteError.value
  if (error === 'INVALID_AMOUNT') return zh.value ? '请输入大于 0 的 BNB 金额，最多 18 位小数。' : 'Enter a positive BNB amount with up to 18 decimal places.'
  if (error === 'INVALID_CONFIDENCE') return zh.value ? '置信度需为 0–100 的整数，也可留空。' : 'Confidence must be an integer from 0 to 100, or left blank.'
  if (error === 'INVALID_CALLOUT') return zh.value ? '喊单内容最多 1000 字，不能包含无效字符。' : 'Callout text may contain up to 1,000 characters, without invalid characters.'
  if (error === 'INVALID_REFERRAL') return zh.value ? '无法确认来源交易信息，请重新打开这笔交易。' : 'The source trade could not be identified. Reopen that trade.'
  if (error === 'MARKET_CHANGED') return zh.value ? '内盘状态已变化，请刷新页面后重试。' : 'The bonding-curve market has changed. Refresh the page.'
  if (error === 'BUY_LIMIT_EXCEEDED') return zh.value ? '该金额超过单个钱包的内盘购买上限，请减小金额。' : 'This amount exceeds the bonding-curve wallet purchase limit. Reduce the amount.'
  return error ? (zh.value ? '暂时无法获取预估，请重试。' : 'The estimate is temporarily unavailable. Please retry.') : ''
})
const ready = computed(() => chainStore.activeChainId === 56 && !!amount.value && !!estimate.value && !validationError.value && !loading.value && !copying.value)
const estimateFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const estimatedAmount = computed(() => {
  if (!estimate.value) return '—'
  const output = estimate.value.amountOut
  const display = output > 0n && output < 10n ** 16n ? '<0.01' : estimateFormatter.format(Number(formatUnits(output, 18)))
  return `${display} ${props.tick}`
})
async function refreshEstimate() {
  clearTimeout(timer)
  const seq = ++sequence, context = contextKey.value, input = amount.value
  estimate.value = null; quoteError.value = ''; copyError.value = false
  if (!input || chainStore.activeChainId !== 56) { loading.value = false; return null }
  loading.value = true
  try {
    const result = await quoteAgentCurveBuy(props.token as Address, props.version, agentBuyAmount(input))
    if (disposed || seq !== sequence || context !== contextKey.value || input !== amount.value) return null
    estimate.value = result
    return result
  } catch (e) {
    if (!disposed && seq === sequence) quoteError.value = (e as Error).message
    return null
  } finally { if (!disposed && seq === sequence) loading.value = false }
}
watch(amount, () => {
  clearTimeout(timer); sequence++; estimate.value = null; quoteError.value = ''; copyError.value = false; lastCopied.value = null
  loading.value = false
  try { agentBuyAmount(amount.value) } catch { return }
  loading.value = true
  timer = setTimeout(() => { void refreshEstimate() }, 350)
}, { flush: 'sync' })
watch(contextKey, () => {
  clearTimeout(timer); sequence++; amount.value = ''; confidence.value = ''; callout.value = ''
  estimate.value = null; quoteError.value = ''; loading.value = false; lastCopied.value = null; copyError.value = false
}, { flush: 'sync' })
async function copyPrompt() {
  if (!ready.value) return
  copying.value = true; copyError.value = false; lastCopied.value = null
  const context = contextKey.value, input = draft()
  try {
    let current = estimate.value
    if (!current || Date.now() - current.quotedAt > AGENT_QUOTE_TTL) current = await refreshEstimate()
    if (!current || disposed || context !== contextKey.value || input.amount !== amount.value) return
    const value = buildAgentTradePrompt({ ...input, estimate: current })
    await copy(value)
    if (!disposed && context === contextKey.value) lastCopied.value = 'prompt'
  } catch { if (!disposed) copyError.value = true }
  finally { if (!disposed) copying.value = false }
}
async function copyInstall() {
  copyError.value = false
  try { await copy(installCommand); lastCopied.value = 'install' } catch { copyError.value = true }
}
onBeforeUnmount(() => { disposed = true; sequence++; clearTimeout(timer) })
</script>

<template>
  <section class="agent-trade-guide rounded-2xl border border-line bg-surface p-4 text-content" aria-label="Agent trading guide">
    <h3 class="text-lg font-bold">{{ zh ? '使用agent完成购买' : 'Complete your purchase with an agent' }}</h3>
    <p class="mt-2 text-xs leading-5 text-muted">{{ zh ? '填写后复制完整提示词，交给你的 Agent。实际交易由 Agent 重新报价并向你确认。' : 'Fill in the details and copy the complete prompt for your Agent. Your Agent refreshes the quote and asks for confirmation.' }}</p>

    <label class="mt-4 block text-sm font-semibold">
      {{ zh ? '购买金额' : 'Buy amount' }}
      <div class="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
        <input v-model="amount" type="text" inputmode="decimal" autocomplete="off" :disabled="copying" placeholder="0.01" class="min-w-0 flex-1 bg-transparent text-base outline-none" :aria-invalid="validationError === 'INVALID_AMOUNT'" />
        <span class="text-sm">BNB</span>
      </div>
    </label>
    <p class="mt-1 text-xs text-muted">{{ zh ? '包含交易手续费，网络 Gas 另计。' : 'Includes trading fees. Network gas is separate.' }}</p>
    <div class="mt-3 rounded-xl border border-line bg-surface-2 p-3" aria-live="polite">
      <div class="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{{ zh ? '预估接收数量' : 'Estimated tokens received' }}</span>
        <button v-if="amount && !validationError" type="button" :disabled="loading || copying" class="text-orange-normal disabled:opacity-40" @click="refreshEstimate">{{ zh ? '重新预估' : 'Refresh estimate' }}</button>
      </div>
      <p class="mt-1 break-words text-base font-semibold tabular-nums">{{ loading ? (zh ? '预估中…' : 'Estimating…') : estimatedAmount }}</p>
      <p class="mt-1 text-xs text-muted">{{ zh ? '仅供参考，最终数量以 Agent 确认的最新报价为准。' : 'Reference only; final output follows the fresh quote confirmed with your Agent.' }}</p>
    </div>

    <label class="mt-4 block text-sm font-semibold">
      {{ zh ? '置信度（选填）' : 'Confidence (optional)' }}
      <div class="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
        <input v-model="confidence" type="text" inputmode="numeric" autocomplete="off" :disabled="copying" placeholder="0–100" class="min-w-0 flex-1 bg-transparent text-sm outline-none" :aria-invalid="validationError === 'INVALID_CONFIDENCE'" />
        <span class="text-sm">%</span>
      </div>
    </label>
    <label class="mt-4 block text-sm font-semibold">
      {{ zh ? '喊单内容（选填）' : 'Callout text (optional)' }}
      <textarea v-model="callout" rows="3" :disabled="copying" :placeholder="zh ? '写下你的买入理由或观点，也可留空' : 'Your reason or thesis for this buy; leave blank if not needed'" class="mt-2 block w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-normal leading-5 outline-none" :aria-invalid="validationError === 'INVALID_CALLOUT'" />
    </label>
    <p v-if="referralAddress" class="mt-3 break-all text-xs leading-5 text-muted">{{ zh ? '推荐 IPShare 主体（原交易者钱包）：' : 'Referral IPShare subject (original trader wallet):' }} {{ referralAddress }}</p>
    <p v-if="errorLabel" role="alert" class="mt-3 text-xs text-red-normal">{{ errorLabel }}</p>
    <p v-if="copyError" role="alert" class="mt-3 text-xs text-red-normal">{{ zh ? '复制失败，请重试。' : 'Copy failed. Please retry.' }}</p>
    <button type="button" class="mt-4 w-full rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" :disabled="!ready || !isSupported" @click="copyPrompt">{{ copying ? (zh ? '正在生成…' : 'Preparing…') : (zh ? '复制交易 Prompt' : 'Copy trade prompt') }}</button>
    <p v-if="copied && lastCopied === 'prompt'" role="status" class="mt-2 text-xs text-orange-normal">{{ zh ? '已复制完整交易提示词，可直接交给你的 Agent。' : 'Complete trade prompt copied. Send it to your Agent.' }}</p>
    <details class="group mt-4 rounded-xl border border-line p-3">
      <summary class="cursor-pointer text-xs font-semibold">{{ zh ? '安装 Skill 与默认交易设置' : 'Install Skill and trade settings' }}</summary>
      <code class="mt-3 block break-all rounded-lg border border-line bg-surface-2 p-2 text-xs">{{ installCommand }}</code>
      <button type="button" v-if="isSupported" class="mt-2 text-xs font-semibold text-orange-normal" :disabled="copying" @click="copyInstall">{{ zh ? '复制安装命令' : 'Copy install command' }}</button>
      <span v-if="copied && lastCopied === 'install'" role="status" class="ml-2 text-xs text-orange-normal">{{ zh ? '已复制' : 'Copied' }}</span>
      <p class="mt-3 text-xs leading-5 text-muted">{{ zh ? '默认滑点 2%；Gas 与手续费使用实时报价。不自动加价、放宽滑点或重发交易；每笔交易经钱包预览确认后执行。内盘购买资格及个人额度由 Agent 使用实际交易钱包核验。' : 'Default slippage is 2%. Gas and fees use live quotes. No automatic gas/slippage increases or resubmission. Confirm each wallet preview; your Agent checks eligibility and limits using the actual trading wallet.' }}</p>
    </details>
  </section>
</template>
