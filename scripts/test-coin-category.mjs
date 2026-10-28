import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const source = readFileSync(new URL('../src/utils/coinCategory.ts', import.meta.url), 'utf8')
const context = { exports: {} }
runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context)
const { isMemeEtf, isAgentLaunch, isGraduatedToken, getLaunchPlatform } = context.exports
const gangToken = '0x0c6302401aa5325c2e36f170f52c00b1d220b405'
const aiToken = '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc'
const flapToken = { token: '0xb0e974ee58899dd77eb13c2c0a0adefeb30f7777', isImport: 1,
  launchProtocol: 'flap-id-agent-curve', pair: '0x' + '1'.repeat(40) }
assert.equal(isAgentLaunch(flapToken, 56), true)
assert.equal(isGraduatedToken(flapToken, 56), true)
assert.equal(isGraduatedToken({ ...flapToken, pair: '' }, 56), false)
assert.equal(getLaunchPlatform(flapToken, 56), 'flap')
assert.equal(isAgentLaunch({ ...flapToken, launchProtocol: undefined }, 56), false)
assert.equal(isAgentLaunch(flapToken, 4663), false)
assert.equal(getLaunchPlatform(flapToken, 4663), null)
assert.equal(getLaunchPlatform({ ...flapToken, isImport: 0 }, 56), null)
assert.equal(getLaunchPlatform({ token: gangToken, isImport: 1 }, 56), 'gang')
assert.equal(getLaunchPlatform({ token: gangToken.toUpperCase(), isImport: 1 }, 56), 'gang')
assert.equal(getLaunchPlatform({ token: gangToken }, 4663), null)
assert.equal(getLaunchPlatform({ token: aiToken, version: 15 }, 56), null)
assert.equal(getLaunchPlatform({ tick: 'GANG', token: '0x' + '1'.repeat(40), isImport: 1 }, 56), null)
assert.equal(getLaunchPlatform({ version: 15 }, 56), 'tagai')
assert.equal(getLaunchPlatform({ version: 17 }, 56), 'tagai')
assert.equal(getLaunchPlatform({ version: 16, isImport: true }, 56), null)
assert.equal(getLaunchPlatform({}, 56), null)
for (const [tick, token] of [
  ['.ai', '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc'],
  ['GANG', '0x0c6302401aa5325c2e36f170f52c00b1d220b405'],
]) {
const externalAgent = { tick, token,
  version: 10, isImport: 1, pair: '0x' + '1'.repeat(40), listed: '0' }
assert.equal(isAgentLaunch(externalAgent, 56), true)
assert.equal(isGraduatedToken(externalAgent, 56), true)
assert.equal(isMemeEtf(externalAgent, 56), false)
assert.equal(externalAgent.version, 10)
assert.equal(externalAgent.isImport, 1)
assert.equal(isAgentLaunch({ ...externalAgent, token: externalAgent.token.toUpperCase() }, 56), true)
assert.equal(isAgentLaunch(externalAgent, 4663), false)
assert.equal(isGraduatedToken(externalAgent, 4663), false)
assert.equal(isAgentLaunch({ ...externalAgent, token: '0x' + '2'.repeat(40) }, 56), false)
assert.equal(isAgentLaunch({ ...externalAgent, chainId: 4663 }, 56), false)
for (const pair of ['', '0x' + '0'.repeat(40), 'not-a-pool']) {
  assert.equal(isGraduatedToken({ ...externalAgent, pair }, 56), false)
}
assert.equal(isGraduatedToken({ ...externalAgent, pair: '0x' + '1'.repeat(64) }, 56), true)
}
for (const listed of [true, 1, '1', 'true']) assert.equal(isGraduatedToken({ listed }), true)
for (const listed of [false, 0, '0', undefined]) assert.equal(isGraduatedToken({ listed }), false)
assert.equal(isGraduatedToken({ listed: false, listedBlock: '100' }), true)
assert.equal(isGraduatedToken({ listedDayNumber: 100 }), true)
for (const [chain, version, expected] of [[4663, 11, true], [4663, '14', true], [4663, 9, false], [4663, 13, false], [56, 11, false], [56, 13, true], [56, 14, true], [56, 15, false], [56, 16, false], [56, 17, false], [4663, 16, false], [4663, 17, false]]) {
  assert.equal(isMemeEtf({ version, isImport: 0 }, chain), expected)
  assert.equal(isMemeEtf({ version, isImport: 1 }, chain), false)
}
for (const version of [15, '15', 16, '16', 17, '17', 18, '18']) {
  assert.equal(isAgentLaunch({ version }, 56), true)
  assert.equal(isAgentLaunch({ version, listed: true }, 56), true)
  assert.equal(isAgentLaunch({ version }, 4663), false)
  assert.equal(isAgentLaunch({ version, isImport: 1 }, 56), false)
  assert.equal(isAgentLaunch({ version, chainId: 4663 }, 56), false)
}
for (const version of [9, 11, 12, 13, 14, 19]) assert.equal(isAgentLaunch({ version }, 56), false)
const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
assert.equal((home.match(/:show-launch-platform="tagCoinSource === 'agent'"/g) || []).length, 3)
const card = readFileSync(new URL('../src/components/home/TagListItem.vue', import.meta.url), 'utf8')
assert.equal((card.match(/<LaunchPlatformBadge v-if="launchPlatform" :platform="launchPlatform"/g) || []).length, 2)
assert.match(card, /getLaunchPlatform\(props\.community, chainStore\.activeChainId\)/)
assert.match(card, /props\.showLaunchPlatform \|\| \['flap', 'four'\]\.includes/)
assert.match(card, /community\.listed && !\(\(showLaunchPlatform \|\| launchPlatform\) && community\.isImport\)/)
assert.equal((card.match(/<slot name="logo"[^\n]+\n\s*<LaunchPlatformBadge/g) || []).length, 2)
const badge = readFileSync(new URL('../src/components/common/LaunchPlatformBadge.vue', import.meta.url), 'utf8')
assert.match(badge, /@\/assets\/logo\.png/)
assert.match(badge, /@\/assets\/gang-launchpad\.svg/)
assert.match(badge, /@\/assets\/flap-launchpad\.svg/)
assert.match(badge, /h-5 w-5[^"\n]*rounded-full/)
assert.match(badge, /web:h-6 web:w-6/)
assert.match(home, /agent-stage-navigation[^"\n]*w-full[^"\n]*px-3[^"\n]*web:mx-auto[^"\n]*web:max-w-\[1240px\]/)
for (const token of [{}, { version: 19 }, { version: 10, isImport: 1 }, { version: 15, isImport: true }]) {
  assert.equal(isAgentLaunch(token, 56), false)
}
assert.match(home, /value: 'all'[\s\S]*value: 'agent'[\s\S]*value: 'memeetf'[\s\S]*value: 'launch'[\s\S]*value: 'import'/)
console.log('Coin category chain, version and imported-token checks passed')

const four = { token: '0x5f6a1ce1733fc4834a526798c0e8cf85137effff', isImport: 1, launchProtocol: 'four-agent-id', pair: '0x' + '1'.repeat(40) }
assert.equal(isAgentLaunch(four, 56), true)
assert.equal(isGraduatedToken(four, 56), true)
assert.equal(getLaunchPlatform(four, 56), 'four')
assert.equal(isAgentLaunch(four, 4663), false)
assert.equal(getLaunchPlatform(four, 4663), null)
assert.equal(isAgentLaunch({ ...four, launchProtocol: undefined }, 56), false)

const gang = { token: '0x1e358076f379c091c0479fa0a4cd574d7a58c5dc', isImport: 1, launchProtocol: 'gang-agent', pair: '0x79be6910c2854437a0a9a41253b39c5b45f2646e' }
assert.equal(isAgentLaunch(gang, 56), true)
assert.equal(isGraduatedToken(gang, 56), true)
assert.equal(getLaunchPlatform(gang, 56), 'gang')
assert.equal(isAgentLaunch(gang, 4663), false)
assert.equal(getLaunchPlatform({ ...gang, isImport: 0 }, 56), null)
