<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'

const props = defineProps<{ token: string; tick: string }>()
const { locale } = useI18n()
const zh = computed(() => String(locale.value).startsWith('zh'))
const { copy, copied, isSupported } = useClipboard({ legacy: true })
const skillUrl = 'https://tagclaw.com/skills/tagclaw-onchain/SKILL.md'
const installCommand = 'npx skills add https://tagclaw.com --skill tagclaw-onchain'
const prompt = computed(() => zh.value
  ? `请使用 ${skillUrl} 查询 BNB Chain（56）代币 ${props.tick}，CA：${props.token}。我希望交易此代币，请先询问买卖方向和金额，检查 .ai Agent ID 资格，并展示报价、最低到账、滑点、手续费和 Gas；每笔交易获得我的确认后再执行。`
  : `Use ${skillUrl} for ${props.tick} on BNB Chain (56), CA: ${props.token}. Ask me for the side and amount, check .ai Agent ID eligibility, and show the quote, minimum output, slippage, fees and gas. Obtain my confirmation for each transaction before executing.`)
const settings = computed(() => zh.value ? [
  ['默认滑点容忍度', '2%（以确认报价为准）'],
  ['Gas', '由签名钱包估算'],
  ['交易手续费', '以协议实时报价为准'],
  ['自动加价 / 放宽滑点', '不自动调整'],
  ['失败自动重发', '关闭；先核对交易状态'],
] : [
  ['Default slippage', '2% (verify the quote)'],
  ['Gas', 'Estimated by the signing wallet'],
  ['Trading fees', 'From the live protocol quote'],
  ['Automatic gas / slippage increase', 'No automatic changes'],
  ['Automatic resubmission', 'Off; reconcile transaction status first'],
])
</script>

<template>
  <section class="agent-trade-guide rounded-2xl border border-line bg-surface p-4 text-content" aria-label="Agent trading guide">
    <h3 class="text-lg font-bold">{{ zh ? '告诉 Agent，确认后交易' : 'Tell your Agent. Review and confirm.' }}</h3>
    <p class="mt-2 text-xs leading-5 text-muted">{{ zh ? '内盘买入仅限具有 .ai Agent ID 的钱包。Agent 检查资格、预览并跟进结果；签名和执行由你现有的 Agent 钱包完成。' : 'Bonding-curve buys require a wallet with a .ai Agent ID. Your Agent checks eligibility, previews and tracks the result; your existing Agent wallet signs and executes.' }}</p>

    <div class="mt-4 rounded-xl border border-orange-normal/30 bg-surface-2 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-semibold">{{ zh ? '安装 TagClaw 技能' : 'Install the TagClaw skill' }}</h4>
        <a :href="skillUrl" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-orange-normal underline" :aria-label="zh ? '打开 TagClaw SKILL 文档（新窗口）' : 'Open TagClaw SKILL documentation (new window)'">TagClaw SKILL ↗</a>
      </div>
      <code class="mt-3 block break-all rounded-lg border border-line bg-surface p-2 text-xs leading-5">{{ installCommand }}</code>
      <div class="mt-2 flex flex-wrap gap-2">
        <button v-if="isSupported" type="button" class="rounded-lg bg-gradient-primary px-3 py-2 text-xs font-semibold text-white" @click="copy(installCommand)">{{ zh ? '复制安装命令' : 'Copy install command' }}</button>
        <button v-if="isSupported" type="button" class="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold" @click="copy(prompt)">{{ zh ? '复制代币交易指引' : 'Copy token instructions' }}</button>
      </div>
      <p v-if="copied" role="status" class="mt-2 text-xs text-orange-normal">{{ zh ? '已复制' : 'Copied' }}</p>
      <p class="mt-3 text-xs leading-5 text-muted">{{ zh ? '安装完整技能后，告诉 Agent 买卖方向、金额和下方 CA。无需创建 TagAI 账号；不要向 Agent 提供私钥或助记词。' : 'Install the complete skill, then give your Agent the side, amount and CA below. No TagAI account is required. Never share private keys or seed phrases.' }}</p>
      <p class="mt-2 break-all font-mono text-xs">BNB Chain · {{ tick }}<br>CA: {{ token }}</p>
    </div>

    <details class="group mt-4 rounded-xl border border-line p-3">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{{ zh ? '默认交易设置' : 'Default trading settings' }}</span>
        <span class="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <dl class="mt-3 space-y-2 text-xs">
        <div v-for="[label, value] in settings" :key="label" class="grid grid-cols-2 gap-3"><dt class="text-muted">{{ label }}</dt><dd>{{ value }}</dd></div>
      </dl>
      <p class="mt-3 rounded-lg bg-surface-2 p-2 text-xs leading-5 text-muted">{{ zh ? '自定义合约调用不能据此保证防夹。每笔交易请确认金额、最低到账、费用及钱包预览；实际费用以钱包预览为准。授权与兑换可能分为多笔交易，每笔均需确认。' : 'Custom contract calls do not guarantee MEV protection. Review the amount, minimum output, fees and wallet preview for each transaction. Approvals and swaps may require separate confirmations.' }}</p>
    </details>
  </section>
</template>
