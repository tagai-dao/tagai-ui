import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const locales = ['zh', 'en', 'ja', 'ko', 'es', 'hi', 'id']
for (const locale of locales) {
  const { onboard } = JSON.parse(readFileSync(new URL(`../src/lang/locales/${locale}.json`, import.meta.url), 'utf8'))
  for (const key of ['title', 'step1', 'step2', 'step3', 'dismiss']) assert.ok(onboard[key]?.trim(), `${locale}.${key}`)
  assert.ok(onboard.step1.includes('.ai Agent ID'), locale)
  assert.ok(!Object.values(onboard).some(text => /#TagAI|TagCoin|预测市场|prediction markets/.test(text)), locale)
}
const zh = JSON.parse(readFileSync(new URL('../src/lang/locales/zh.json', import.meta.url), 'utf8')).onboard
assert.equal(zh.step2, '创建智能投资组合，表达你的观点')
assert.equal(zh.step3, '参与社交交易、币股流动性提供、社交分享，并获得奖励')
const view = readFileSync(new URL('../src/views/home/HomePost.vue', import.meta.url), 'utf8')
assert.match(view, /list-decimal list-outside pl-5 break-words/)
console.log('Onboarding copy: all 7 locales, terminology and wrapped list layout passed')
