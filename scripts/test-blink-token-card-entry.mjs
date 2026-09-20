import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync('src/components/tweets/CommerceBtn.vue', 'utf8')
const { descriptor } = parse(source)
const render = new Function('Vue', compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
for (const showBlinkLogin of [true, false]) {
  for (const token of ['', '0x2222222222222222222222222222222222222222']) {
    const app = Vue.createSSRApp({
      render,
      setup: () => ({
        tweet: { commerceId: 'blink1', tick: 'BUIDL', token },
        predictionEnabled: false, commerceType: 1, eventMarket: null, battleMarket: null,
        showBlinkLogin, loginReturnPath: '/bsc/commerce/blink1', showTradeModal: false,
        gotoTrade() {}, tradeDialogContentRef: null,
      }),
    })
    app.component('BlinkTwitterLoginButton', { render: () => Vue.h('button', 'Twitter login') })
    app.component('ElDialog', { render: () => null })
    for (const name of ['PredictEventCard', 'PredictBattleCard', 'BuyAndSellView']) {
      app.component(name, { render: () => null })
    }
    const html = await renderToString(app)
    assert.equal(html.includes('Trade $BUIDL'), !showBlinkLogin && !token,
      'Trade is only a fallback when the token card is absent')
    assert.equal(html.includes('Twitter login'), showBlinkLogin, 'retain anonymous web login')
  }
}
const card = readFileSync('src/components/feed/CommunityTradeCard.vue', 'utf8')
assert.match(card, /commerceId: props\.tweet\.commerceId/)
assert.match(card, /getChainPath\(chainStore\.activeChainId, `\/commerce\//)
const sheet = readFileSync('src/components/feed/FeedTokenTradeSheet.vue', 'utf8')
assert.match(sheet, /:commerce-id="asset.commerceId"/)
assert.match(sheet, /:login-return-path="asset.loginReturnPath"/)
const trade = readFileSync('src/views/buy-sell/BuyAndSellView.vue', 'utf8')
assert.match(trade, /const blinkId = explicitSource \|\| blinkIdFromRoute\(route\)/)
assert.match(trade, /if \(explicitSource\) throw new Error\('Blinks source does not match this token\.'/)
console.log('Blinks token-card entry: duplicate removal, legacy fallback, login and source propagation passed')
