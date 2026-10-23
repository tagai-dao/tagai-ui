import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const source = readFileSync(new URL('../src/utils/coinCategory.ts', import.meta.url), 'utf8')
const context = { exports: {} }
runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context)
const { isMemeEtf, isAgentLaunch, isGraduatedToken } = context.exports
for (const listed of [true, 1, '1', 'true']) assert.equal(isGraduatedToken({ listed }), true)
for (const listed of [false, 0, '0', undefined]) assert.equal(isGraduatedToken({ listed }), false)
assert.equal(isGraduatedToken({ listed: false, listedBlock: '100' }), true)
assert.equal(isGraduatedToken({ listedDayNumber: 100 }), true)
for (const [chain, version, expected] of [[4663, 11, true], [4663, '14', true], [4663, 9, false], [4663, 13, false], [56, 11, false], [56, 13, true], [56, 14, true], [56, 15, false], [56, 16, false], [4663, 16, false]]) {
  assert.equal(isMemeEtf({ version, isImport: 0 }, chain), expected)
  assert.equal(isMemeEtf({ version, isImport: 1 }, chain), false)
}
for (const version of [15, '15', 16, '16']) {
  assert.equal(isAgentLaunch({ version }, 56), true)
  assert.equal(isAgentLaunch({ version, listed: true }, 56), true)
  assert.equal(isAgentLaunch({ version }, 4663), false)
  assert.equal(isAgentLaunch({ version, isImport: 1 }, 56), false)
  assert.equal(isAgentLaunch({ version, chainId: 4663 }, 56), false)
}
for (const version of [9, 11, 12, 13, 14, 17]) assert.equal(isAgentLaunch({ version }, 56), false)
const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
assert.equal((home.match(/:show-launch-platform="tagCoinSource === 'agent'"/g) || []).length, 3)
const card = readFileSync(new URL('../src/components/home/TagListItem.vue', import.meta.url), 'utf8')
assert.equal((card.match(/<LaunchPlatformBadge v-if="showTagaiLaunchPlatform"/g) || []).length, 2)
assert.match(card, /props\.showLaunchPlatform\s*&& isAgentLaunch\(props\.community, chainStore\.activeChainId\)/)
for (const token of [{}, { version: 17 }, { version: 10, isImport: 1 }, { version: 15, isImport: true }]) {
  assert.equal(isAgentLaunch(token, 56), false)
}
assert.match(home, /value: 'all'[\s\S]*value: 'agent'[\s\S]*value: 'memeetf'[\s\S]*value: 'launch'[\s\S]*value: 'import'/)
console.log('Coin category chain, version and imported-token checks passed')
