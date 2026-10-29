import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const scope = { exports: {} }
runInNewContext(ts.transpile(read('src/utils/agentOnlyToken.ts'), { module: ts.ModuleKind.CommonJS }), scope)
const eligible = scope.exports.isAgentOnlyCurveToken
for (const version of [15, 16, 17, 18, '15', '16', '17', '18']) {
  assert.equal(eligible({ version, listed: false }, 56), true)
  for (const flag of [true, 1, '1', 'true']) assert.equal(eligible({ version, listed: flag }, 56), false)
  assert.equal(eligible({ version, listedBlock: 123 }, 56), false)
  assert.equal(eligible({ version, isImport: 1 }, 56), false)
  assert.equal(eligible({ version }, 4663), false)
}
for (const version of [9, 11, 13, 14, 19]) assert.equal(eligible({ version }, 56), false)

const trade = read('src/views/buy-sell/BuyAndSellView.vue')
const home = read('src/views/tag-detail/HomeTagDetail.vue')
assert.match(trade, /agentGuide: \{type: Boolean, default: true\}/)
for (const file of ['src/components/feed/FeedTokenTradeSheet.vue', 'src/components/tweets/CommerceBtn.vue', 'src/views/wallet/TabHoldTag.vue']) {
  const entry = read(file)
  assert.match(entry, /<BuyAndSellView\b/)
  assert.doesNotMatch(entry, /:agent-guide="false"/)
}
const sheet = read('src/components/feed/FeedTokenTradeSheet.vue')
for (const attribution of [':tweet-id="asset.tweetId"', ':sellsman="asset.sellsman"', ':commerce-id="asset.commerceId"', ':login-return-path="asset.loginReturnPath"']) assert.ok(sheet.includes(attribution))
assert.match(trade, /props\.agentGuide[\s\S]*isAgentOnlyCurveToken\(comStore.currentSelectedCommunity, chainStore.activeChainId\)\s*&& !listed.value/)
assert.match(trade, /<AgentTradeGuide v-if="showAgentGuide"[^\n]*\n\s*<div v-else/)
assert.equal((home.match(/<BuyAndSellView[^>]*agent-guide/g) || []).length, 2)

const guide = read('src/components/common/AgentTradeGuide.vue')
assert.ok(read('src/utils/agentTradePrompt.ts').includes('https://tagclaw.com/skills/tagclaw-onchain/SKILL.md'))
assert.ok(guide.includes('npx skills add https://tagclaw.com --skill tagclaw-onchain'))
assert.ok(guide.includes('2%'))
assert.ok(guide.includes('CA: {{ token }}'))
assert.ok(guide.includes('props.token'))
assert.match(guide, /<a :href="skillUrl"[^>]*target="_blank"[^>]*>TagClaw SKILL/)
assert.match(guide, /v-model="amount"/)
assert.match(guide, /v-model="confidence"/)
assert.match(guide, /v-model="callout"/)
assert.match(guide, /复制交易 Prompt/)
assert.match(guide, /quoteAgentCurveBuy/)
assert.match(guide, /AGENT_QUOTE_TTL/)
assert.match(trade, /:referral-address="props.sellsman/)
assert.doesNotMatch(sheet, /sourceTradeHash|source-trade-hash/)
assert.doesNotMatch(guide, /sourceTradeHash|source-trade-hash/)
assert.match(read('src/components/feed/FeedTradeActivity.vue'), /sellsman: props.trade.trader/)
const { descriptor } = parse(guide)
const compiled = compileScript(descriptor, { id: 'agent-guide-test' })
const template = compileTemplate({ source: descriptor.template.content, filename: 'AgentTradeGuide.vue', id: 'agent-guide-test', compilerOptions: { bindingMetadata: compiled.bindings } })
assert.deepEqual(template.errors, [])
console.log('Agent guide scope, graduation, skill, defaults, token context and template checks passed')
