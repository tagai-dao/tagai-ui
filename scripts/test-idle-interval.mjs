import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
test('replacing an interval leaves one timer, hidden pages skip work, teardown releases it', () => {
  const exports = {}, timers = new Map(), hooks = [], document = { hidden: false }
  let id = 0, calls = 0
  const vue = { ref: value => ({ value }), onUnmounted: fn => hooks.push(fn), onDeactivated: fn => hooks.push(fn) }
  const js = ts.transpileModule(readFileSync('src/composables/useTools.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  new Function('exports', 'require', 'document', 'setInterval', 'clearInterval', js)(exports,
    name => name === 'vue' ? vue : {}, document,
    fn => { timers.set(++id, fn); return id }, timer => timers.delete(timer))
  const { setInter } = exports.useInterval()
  setInter(() => calls++, 3000)
  setInter(() => calls++, 3000)
  assert.equal(timers.size, 1)
  const tick = [...timers.values()][0]
  tick()
  document.hidden = true
  tick()
  assert.equal(calls, 1)
  document.hidden = false
  tick()
  assert.equal(calls, 2)
  hooks.forEach(fn => fn())
  assert.equal(timers.size, 0)
})
