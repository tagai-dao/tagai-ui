import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpile(readFileSync(new URL('../src/utils/tokenDisplayName.ts', import.meta.url), 'utf8'),
  { module: ts.ModuleKind.CommonJS }), context)
const { tokenDisplayName } = context.exports
const identity = { tick: 'BIBI_0F7777', token: '0xb0e974ee58899dd77eb13c2c0a0adefeb30f7777',
  launchProtocol: 'flap-id-agent-curve', isImport: 1 }
const check = (row, name, suffix, chain = 56) => {
  const result = tokenDisplayName(row, chain)
  assert.equal(result.name, name)
  assert.equal(result.suffix, suffix)
}
check(identity, 'BIBI', '@0F7777')
check({ ...identity, tick: 'HEYI_CF7777', token: '0x7832c85c1910945d54494424f606e90c92cf7777' }, 'HEYI', '@CF7777')
check({ ...identity, tick: 'CZ_2E7777', token: '0xcf75c12e660b4bb06e69e00f052269e89f2e7777' }, 'CZ', '@2E7777')
check({ ...identity, tick: 'ai_FD7777', token: '0xbdfcd595f1d8d2d9b8c7e9754e2636cf29fd7777' }, '.ai', '@FD7777')
check({ ...identity, tick: 'ai_797777', token: '0x3437febd7b451a2293787fb84fcdf2f9c9797777' }, '.ai', '@797777')
for (const tick of ['F_ai', 'CURVE', 'BIBI_DEAD', 'NAME_0F7777X']) check({ ...identity, tick }, tick, '')
for (const row of [{ ...identity, chainId: 4663 }, { ...identity, chain_id: 4663 },
  { ...identity, isImport: 0 }, { ...identity, launchProtocol: undefined }, { ...identity, token: '' }]) {
  check(row, identity.tick, '')
}
check(identity, identity.tick, '', 4663)
check({ ...identity, chainId: 56 }, 'BIBI', '@0F7777', 4663)
assert.equal(identity.tick, 'BIBI_0F7777') // navigation/registration identity stays unchanged
console.log('Token display names: original symbols, exact suffix identity and chain/protocol boundaries passed')
