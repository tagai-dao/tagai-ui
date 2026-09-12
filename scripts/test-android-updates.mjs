import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../src/utils/androidUpdatePolicy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { parseAndroidRelease: parse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const release = { enabled: true, applicationId: 'fun.tagai.app', versionCode: 21,
  versionName: '1.0.21', notes: 'Fixes', downloadUrl: 'https://tagai.fun/downloads/TagAI-21.apk' }
assert.equal(parse(release, 20).versionCode, 21)
for (const patch of [
  { enabled: false }, { applicationId: 'other.app' }, { versionCode: 20 },
  { versionCode: 19 }, { versionCode: 21.5 }, { versionCode: '21' },
  { downloadUrl: 'https://evil.example/app.apk' }, { downloadUrl: 'javascript:alert(1)' },
  { downloadUrl: 'http://tagai.fun/downloads/app.apk' },
  { downloadUrl: 'https://tagai.fun/downloads/app.apk?redirect=1' },
  { downloadUrl: 'https://user:password@tagai.fun/downloads/app.apk' },
  { notes: 'x'.repeat(4001) }, { versionName: '' },
]) assert.equal(parse({ ...release, ...patch }, 20), null)
assert.equal(parse(null, 20), null)
assert.equal(parse(release, NaN), null)
assert.equal(parse(release, 0), null)
assert.equal(parse(JSON.parse(readFileSync(new URL('../public/app-updates/android.json', import.meta.url), 'utf8')), 1), null)
console.log('Android update policy: 18 cases passed')
