import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const context = vm.createContext({ exports: {} })
vm.runInContext(ts.transpileModule(readFileSync('src/utils/agentOnlyToken.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const show = context.exports.isAgentOnlyCurveToken
let count = 0
function check(metadata, chainId, expected) {
  assert.equal(show(metadata, chainId), expected, JSON.stringify({ metadata, chainId }))
  count++
}
check({ chainId: 56, version: 15, listedBlock: 0, listedDayNumber: 0, isImport: 0 }, 56, true) // live AIPRO shape
check({ version: '15', listed: '0', isImport: 'false' }, 56, true)
check({ chain_id: '56', version: 15 }, 4663, true)
for (const version of [8, 9, 10, 11, 13, 14, 17, undefined, null]) check({ version }, 56, false)
check({ version: 15 }, 4663, false)
check({ chainId: 4663, version: 15 }, 56, false)
for (const value of [true, 1, '1', 'true']) {
  check({ version: 15, listed: value }, 56, false)
  check({ version: 15, isImport: value }, 56, false)
}
check({ version: 15, listedBlock: 123 }, 56, false)
check({ version: 15, listedDayNumber: '20748' }, 56, false)
check(null, 56, false)
check(undefined, 56, false)
const token = { version: 15, listed: false }
check(token, 56, true)
token.listed = true
check(token, 56, false)

const logo = readFileSync('src/components/common/CommunityLogo.vue', 'utf8')
assert.match(logo, /computed\(\(\) => isAgentOnlyCurveToken/)
assert.match(logo, /<AgentOnlyBadge v-if="agentOnly"/)
const badge = readFileSync('src/components/common/AgentOnlyBadge.vue', 'utf8')
assert.match(badge, /rotate\(-45\)/)
assert.match(badge, />AI Agent</)
assert.match(badge, /pointer-events: none/)
for (const path of [
  'src/components/home/TagListItem.vue', 'src/components/home/TopTagCoin.vue',
  'src/views/tag-detail/HomeTagDetail.vue', 'src/layout/TopBar.vue',
  'src/components/feed/CommunityTradeCard.vue', 'src/components/feed/FeedTokenDetailSheet.vue',
  'src/components/feed/FeedTradeActivity.vue',
]) assert.match(readFileSync(path, 'utf8'), /:community="/)
console.log(`${count} agent-only badge classification checks and shared UI wiring passed`)

check({ chainId:56,version:16,listed:false },56,true)
check({ chainId:56,version:16,listed:true },56,false)
check({ chainId:4663,version:16 },56,false)
