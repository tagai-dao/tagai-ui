import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Exercise the actual composable with isolated RPC/Vue lifecycle dependencies.
const result = await build({
  entryPoints: ['src/composables/useNutboxNftPool.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', plugins: [{ name: 'nft-test-dependencies', setup(build) {
    build.onResolve({ filter: /^(vue|viem|@\/)/ }, args => ({ path: args.path, namespace: 'mock' }))
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
      const exports = args.path === 'vue'
        ? 'export const ref = value => ({ value }); export const reactive = value => value; export const computed = fn => ({ get value() { return fn() } }); export const onMounted = () => {}; export const onBeforeUnmount = fn => globalThis.fixture.unmount = fn; export const watch = () => {};'
        : args.path === 'viem'
          ? 'export const getAddress = x => x; export const zeroAddress = "0x0000000000000000000000000000000000000000"; export const formatUnits = (v, d) => String(Number(v) / 10 ** d);'
          : args.path.endsWith('/web3') ? 'export const useAccountStore = () => globalThis.fixture.account;'
            : args.path.endsWith('/chain') ? 'export const useChainStore = () => globalThis.fixture.chain;'
              : args.path.endsWith('/contract') ? 'export const resolveContractAddress = () => null;'
                : args.path.includes('/apis/') ? 'export const getNutboxNftRewardSummary = (...a) => globalThis.fixture.rewards(...a);'
                  : `export const erc20NutboxAbi=[], indexBrokerNftAbi=[], indexBrokerNftAmmAbi=[], indexBrokerNftRendererAbi=[], nutboxCommitteeAbi=[], nutboxCommunityAbi=[], nutboxRouterAbi=[];
                    export const readNutboxContract = (...a) => globalThis.fixture.read(...a);
                    export const getNutboxReadClient = () => ({ getBlockNumber: () => globalThis.fixture.block() });
                    export const writeNutboxContract = (...a) => globalThis.fixture.write(...a);
                    export const imageCandidatesFromTokenUri = () => []; export const svgDataUrl = x => x; export const withFeeBuffer = x => x + 1n;`
      return { contents: exports, loader: 'js' }
    })
  } }],
})
const { useNutboxNftPool } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const zero = '0x0000000000000000000000000000000000000000'
const pool = { pool: '0xpool', amm: '0xamm', communityToken: '0xtoken', community: '0xcommunity' }
function setup(poolOverrides = {}) {
  const calls = []
  const fields = { name: 'HBTC NFT', symbol: 'HBTC', decimals: 18, communityTokenPrice: 210n * 10n ** 18n,
    nativePrice: 2000000000000000n, totalSupply: 3n, maxSupply: 1000n, levelCount: 0,
    renderer: zero, tokensOfOwner: [], active: true }
  globalThis.fixture = {
    account: { ethConnectAddress: '' }, chain: { activeChainId: 4663 },
    read: async (_address, _abi, name) => { calls.push(name); return fields[name] ?? 0n },
    block: async () => 10n, rewards: async () => null, write: async () => 'tx',
  }
  return { model: useNutboxNftPool({ value: { ...pool, ...poolOverrides } }), calls, fields, fixture: globalThis.fixture }
}
test('block RPC failure does not discard valid pool prices and supply', async () => {
  const { model, fixture } = setup()
  fixture.block = async () => { throw Error('HTTP request failed.') }
  await model.load()
  assert.equal(model.ready.value, true)
  assert.equal(model.state.totalSupply, 3n)
  assert.equal(model.state.nativePrice, 2000000000000000n)
  assert.equal(model.state.currentBlock, 0n)
  assert.equal(model.error.value, '')
})
test('slow reward API does not block the market', async () => {
  const { model, fixture } = setup()
  fixture.rewards = () => new Promise(() => {})
  await model.load()
  assert.equal(model.loading.value, false)
  assert.equal(model.ready.value, true)
})
test('overlapping refreshes share one round of RPC reads', async () => {
  const { model, calls } = setup()
  const first = model.load()
  assert.equal(model.load(), first)
  await first
  assert.equal(calls.filter(name => name === 'totalSupply').length, 1)
})
test('slow APR quote does not block the NFT preview', async () => {
  const { model, fixture, fields } = setup({ nutboxRouter: '0xrouter' })
  fields.renderer = '0xrenderer'
  fields.renderSVG = '<svg />'
  const read = fixture.read
  fixture.read = (...args) => args[2] === 'quoteNative' ? new Promise(() => {}) : read(...args)
  await model.load()
  assert.equal(model.mintPreviewImage.value, '<svg />')
})
test('failed critical read is not shown as a zero-price market; retry recovers', async () => {
  const { model, fixture } = setup()
  const read = fixture.read
  fixture.read = async (...args) => {
    if (args[2] === 'nativePrice') throw Error('offline')
    return read(...args)
  }
  await model.load()
  assert.equal(model.ready.value, false)
  assert.match(model.error.value, /temporarily unavailable/)
  fixture.read = read
  await model.load()
  assert.equal(model.ready.value, true)
  fixture.read = async () => { throw Error('offline') }
  await model.load()
  assert.equal(model.state.totalSupply, 3n)
  assert.equal(model.state.nativePrice, 2000000000000000n)
  assert.match(model.error.value, /last loaded data/)
})
test('chain switch discards previous chain results', async () => {
  const { model, fixture } = setup()
  const loading = model.load()
  fixture.chain.activeChainId = 56
  await loading
  assert.equal(model.ready.value, false)
})
test('mint re-reads the price instead of using display state', async () => {
  const { model, fields, fixture } = setup()
  fixture.account.ethConnectAddress = '0xaccount'
  await model.load()
  fields.nativePrice = 3000000000000000n
  let sentValue
  fixture.write = async (...args) => { sentValue = args[4]; return 'tx' }
  await model.mint()
  assert.equal(sentValue, 3000000000000000n)
})
