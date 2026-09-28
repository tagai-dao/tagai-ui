import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parseAbi, zeroAddress } from 'viem'
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const source = readFileSync('src/utils/v13/community-rewards.ts', 'utf8')
const token = '0x1111111111111111111111111111111111111111'
const community = '0x2222222222222222222222222222222222222222'
const calculator = '0x3333333333333333333333333333333333333333'
const unit = 10n ** 18n
function fixture(overrides = {}) {
  const block = { number: 123n, timestamp: BigInt(Date.parse('2026-09-28T08:32:00Z') / 1000) }
  const calls = []
  const values = { nutboxCommunity: community, feeRatio: 500, rewardCalculator: calculator,
    getHourlyRewards: Array.from({ length: 192 }, (_, i) => i < 144 ? 0n : 125n * unit), calculateReward: 3000n * unit, ...overrides }
  const client = { getBlock: async () => block, readContract: async args => {
    calls.push(args)
    if (values[args.functionName] instanceof Error) throw values[args.functionName]
    return values[args.functionName]
  } }
  const exports = {}
  new Function('exports', 'require', compile(source))(exports, name => {
    if (name === 'viem') return { parseAbi, zeroAddress }
    if (name === '@/utils/wallets') return { getReadOnlyClient: chain => { assert.equal(chain, 56); return client } }
    if (name === '@/config/chains') return { getChainDeployment: () => ({ contracts: { hourlyTickCalculator: calculator } }) }
    throw Error(name)
  })
  return { ...exports, calls, block }
}
test('all-pool UTC schedule includes past 7 days and tomorrow at one block, net fees', async () => {
  const f = fixture(), result = await f.readCommunityRewardSchedule(token)
  assert.equal(result.currentHour, 8)
  assert.equal(result.todayIndex, 6)
  assert.equal(result.hourlyRewards.length, 192)
  assert.equal(new Date(result.dayStarts[0] * 1000).toISOString(), '2026-09-22T00:00:00.000Z')
  assert.deepEqual(result.dailyRewards, [...Array(6).fill(0n), 2850n * unit, 2850n * unit])
  assert.ok(f.calls.every(c => c.blockNumber === f.block.number))
  assert.deepEqual(f.calls.at(-1).args, [community, BigInt(result.dayStarts[0]), 192n])
  assert.ok(f.calls.every(c => !/pool|space/i.test(c.functionName)), 'must not reduce total rewards by a social-pool allocation')
  assert.equal(await f.readCommunityDailyRewards(token), 2850n * unit)
  assert.deepEqual(f.calls.at(-1).args, [community, f.block.timestamp / 3600n * 3600n, f.block.timestamp / 3600n * 3600n + 86400n])
})
test('fee bounds, absent community, unsupported calculator and RPC failures', async () => {
  for (const [fee, expected] of [[0, 3000n * unit], [10000, 0n]]) {
    const f = fixture({ feeRatio: fee })
    assert.equal((await f.readCommunityRewardSchedule(token)).dailyRewards[6], expected)
  }
  const absent = fixture({ nutboxCommunity: zeroAddress })
  assert.equal(await absent.readCommunityRewardSchedule(token), undefined)
  assert.equal(await absent.readCommunityDailyRewards(token), 0n)
  for (const overrides of [{ feeRatio: 10001 }, { rewardCalculator: token }, { getHourlyRewards: [] }, { getHourlyRewards: Error('RPC') }]) {
    await assert.rejects(fixture(overrides).readCommunityRewardSchedule(token))
  }
})
const view = readFileSync('src/views/tag-detail/TagToken.vue', 'utf8')
test('Pump13/14 reward button opens the modal immediately and loads the all-pool schedule', async () => {
  assert.match(view, /\[13, 14\]\.includes/)
  assert.match(view, /<button type="button"[^>]*[\s\S]*?:title="\$t\('v13Page.dailyRewardsHelp'\)"[^>]*@click="openDistributionModal"/)
  const body = view.slice(view.indexOf('async function openDistributionModal()'), view.indexOf('const refreshing ='))
  let finish, called = false
  const modal = { value: false }
  const open = new Function('isV13', 'showDistributionModal', 'loadV13RewardSchedule', compile(body) + ';return openDistributionModal')(
    { value: true }, modal, () => { called = true; return new Promise(resolve => { finish = resolve }) })
  const pending = open()
  assert.equal(modal.value, true)
  assert.equal(called, true)
  finish(); await pending
})
test('schedule load ignores an obsolete token response and exposes retryable RPC errors', async () => {
  const body = view.slice(view.indexOf('async function loadV13RewardSchedule()'), view.indexOf('async function loadV9HourlyRewards()'))
  let finish
  const state = Object.fromEntries(['v13ScheduleLoading', 'v13ScheduleError', 'v9HourlyAmounts', 'v9HourlyLabels', 'v9TodayHourlyAmounts', 'v13ScheduleHour', 'v9TodayChartIndex'].map(k => [k, { value: undefined }]))
  const build = reader => new Function('isV13', 'comStore', 'isAddress', 'readCommunityRewardSchedule', ...Object.keys(state),
    compile('let v13ScheduleRequest = 0;\n' + body) + ';return {load:loadV13RewardSchedule,invalidate:()=>v13ScheduleRequest++}')(
    { value: true }, { currentSelectedCommunity: { token } }, () => true, reader, ...Object.values(state))
  const f = build(() => new Promise(resolve => { finish = resolve }))
  const pending = f.load()
  assert.equal(state.v13ScheduleLoading.value, true)
  f.invalidate(); finish({ dailyRewards: [1n] }); await pending
  assert.deepEqual(state.v9HourlyAmounts.value, [])
  const fail = build(async () => { throw Error('RPC') })
  await fail.load()
  assert.equal(state.v13ScheduleError.value, true)
  assert.equal(state.v13ScheduleLoading.value, false)
})
