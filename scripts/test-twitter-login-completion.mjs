import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'

const source = await readFile(new URL('../src/layout/Layout.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
test('Layout script compiles with early auth subscription and cleanup', () => {
  assert.ok(compileScript(descriptor, { id: 'login-regression' }).content)
})
test('auth listeners are registered during setup, not after the React child mounts', () => {
  const script = descriptor.scriptSetup.content
  const mounted = script.indexOf('onMounted( () => {')
  for (const [event, handler] of [
    ['authSuccess', 'handleReactLoginSuccess'], ['authError', 'handleReactLoginError'],
    ['walletError', 'handleWalletError'], ['walletProvider', 'handleWalletProvider'],
  ]) {
    const registration = `emitter.on('${event}', ${handler})`
    assert.ok(script.indexOf(registration) >= 0 && script.indexOf(registration) < mounted)
    assert.match(script, new RegExp(`emitter\\.off\\('${event}', ${handler}\\)`))
  }
})
test('external-wallet login does not initialize or overwrite the bound wallet', () => {
  assert.match(source, /if \(isManualPluginAccount\) \{[\s\S]*?finishNewLoginIfNeeded\(\)\s+return/)
  const complete = source.slice(source.indexOf('const handleReactLoginSuccess'), source.indexOf('/** 用户已用'))
  assert.match(complete, /accStore\.setAccount\(accInfo\)/)
  assert.match(complete, /finishNewLoginIfNeeded\(\)/)
  assert.doesNotMatch(complete, /await.*initWallet|await.*setWallet/)
})
