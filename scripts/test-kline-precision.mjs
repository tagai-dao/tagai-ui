import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = {}
new Function('exports', compile(readFileSync('src/utils/klinePrecision.ts','utf8')))(module)
const { klinePricePrecision } = module
const candle = (open, close=open) => ({ open, close, low: Math.min(open,close), high: Math.max(open,close) })
// Actual Starship indexed prices (native units scaled by 1e18); a representative BNB/USD conversion.
const prices = [6763383640,6767331935,6771280230,6771675040,6775623335,6776018145].map(n=>n/1e18*762.5)
const rows = prices.map((n,i)=>candle(prices[Math.max(0,i-1)],n))
test('Starship candles and the smallest recent buy remain distinguishable',()=>{
  const precision=klinePricePrecision(rows)
  assert.equal(precision,11)
  assert.equal(new Set(prices.map(n=>n.toFixed(6))).size,1,'reproduces the old display')
  assert.equal(new Set(prices.map(n=>n.toFixed(precision))).size,prices.length)
  const delta=prices[5]-prices[4]
  assert.ok(delta < 10**-6,'old precision forces an oversized minimum axis range')
  assert.ok(delta > 10**-precision,'new precision preserves even the smallest buy')
})
test('normal prices retain existing precision and tiny prices remain finite and bounded',()=>{
  for(const price of [1,0.25,60000]) assert.equal(klinePricePrecision([candle(price)]),6)
  assert.equal(klinePricePrecision([candle(1.23456e-10)]),15)
  assert.equal(klinePricePrecision([candle(1e-30)]),20)
  assert.equal(klinePricePrecision([]),6)
  assert.equal(klinePricePrecision([candle(NaN),candle(Infinity),candle(0),candle(-1)]),6)
})
test('precision covers wicks and remains stable for flat candles',()=>{
  assert.equal(klinePricePrecision([{open:1e-4,close:1e-4,high:2e-4,low:1e-8}]),13)
  assert.equal(klinePricePrecision([candle(prices[0])]),11)
})
test('real chart update sets precision before initial, refreshed and switched-period data',()=>{
  const view=readFileSync('src/views/buy-sell/Kline.vue','utf8')
  const body=view.slice(view.indexOf('function updateChart()'),view.indexOf('function setChartRows('))
  const calls=[], chart={value:{setPriceVolumePrecision:(...args)=>calls.push(['precision',...args]),applyNewData:r=>calls.push(['data',r])}}
  const activeTab={value:'5min'},data5min={values:rows},data1h={values:[candle(prices[0],prices[5])]},data1day={values:[candle(100)]}
  const update=new Function('props','chart','activeTab','data5min','data1h','data1day','klinePricePrecision',compile(body)+';return updateChart')({},chart,activeTab,data5min,data1h,data1day,klinePricePrecision)
  for(const [tab,data,precision]of [['5min',data5min,11],['1h',data1h,11],['1d',data1day,6]]) {
    activeTab.value=tab;calls.length=0;update()
    assert.deepEqual(calls,[['precision',precision,2],['data',data.values]])
  }
  activeTab.value='5min';data5min.values=[candle(1.2e-10)];calls.length=0;update()
  assert.deepEqual(calls[0],['precision',15,2])
})
