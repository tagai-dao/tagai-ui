import assert from 'node:assert/strict'
import { build, transform } from 'esbuild'
import { readFileSync } from 'node:fs'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { compile } from '@vue/compiler-dom'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'

const built = await build({
  entryPoints: ['src/utils/nutboxNft.ts', 'src/utils/nftTradeEligibility.ts'], outdir: 'out',
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'isolate-wallet', setup(b) {
    b.onResolve({ filter: /^@\// }, a => ({ path: a.path, namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
      export const getChainDeployment=()=>({}), useAccountStore=()=>({}), useChainStore=()=>({}),
      getChainById=()=>({}), getReadOnlyClient=()=>({}), getWalletClient=()=>({}), setup=()=>{}, waitForTx=()=>{};
    ` }))
  } }],
})
const load = async name => import(`data:text/javascript;base64,${Buffer.from(built.outputFiles.find(f => f.path.endsWith(name + '.js')).text).toString('base64')}`)
const { svgArtworkCandidates, imageCandidatesFromTokenUri, svgDataUrl, withFeeBuffer } = await load('nutboxNft')
const { nftPaymentError } = await load('nftTradeEligibility')
const wrapped = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/nft.png?a=1&amp;b=2" /></svg>'
assert.deepEqual(svgArtworkCandidates(wrapped), ['https://example.com/nft.png?a=1&b=2'])
assert.equal(svgArtworkCandidates('<svg><image href="https://gateway.pinata.cloud/ipfs/bafytest/0006.png" /></svg>').length, 4)
assert.equal(svgArtworkCandidates('<svg><image xlink:href="ipfs://bafytest/1.png"/></svg>').length, 3)
const pure = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>'
assert.deepEqual(svgArtworkCandidates(pure), [svgDataUrl(pure)])
for (const image of [svgDataUrl(wrapped), 'data:image/svg+xml;base64,' + Buffer.from(wrapped).toString('base64')]) {
  const uri = 'data:application/json;base64,' + Buffer.from(JSON.stringify({ image })).toString('base64')
  assert.equal(imageCandidatesFromTokenUri(uri)[0], 'https://example.com/nft.png?a=1&b=2')
}
assert.deepEqual(imageCandidatesFromTokenUri('bad metadata', wrapped).slice(0, 1), ['https://example.com/nft.png?a=1&b=2'])
for (const nativeSymbol of ['ETH', 'BNB']) {
  const p = { tokenRequired: 210n * 10n ** 18n, tokenBalance: 0n, tokenDecimals: 18, tokenSymbol: 'HBTC', nativeRequired: 2n * 10n ** 15n, nativeBalance: 21n * 10n ** 15n, nativeSymbol }
  assert.match(nftPaymentError(p), /Insufficient HBTC: requires 210, but this wallet has 0/)
  p.tokenBalance = p.tokenRequired
  assert.equal(nftPaymentError(p), '')
  p.nativeBalance = p.nativeRequired
  assert.match(nftPaymentError(p), /plus gas/)
  p.nativeRequired = 0n // whitelist still needs gas
  p.nativeBalance = 0n
  assert.match(nftPaymentError(p), /plus gas/)
  p.nativeBalance = 1n
  assert.equal(nftPaymentError(p), '')
  p.nativeRequired = withFeeBuffer(100n)
  p.nativeBalance = 101n
  assert.match(nftPaymentError(p), /Insufficient/)
}
for (const file of ['src/views/tag-detail/nft/components/NftMintAmm.vue', 'src/views/tag-detail/nft/components/NftArtwork.vue']) {
  const { descriptor } = parse(readFileSync(file, 'utf8'))
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, [])
}
console.log('NFT artwork extraction, SVG/IPFS fallbacks, ETH/BNB balances, whitelist gas and template checks passed')

const { descriptor } = parse(readFileSync('src/views/tag-detail/nft/components/NftMintAmm.vue', 'utf8'))
const compiledRender = compile(descriptor.template.content, { mode: 'function', prefixIdentifiers: true }).code
const render = new Function('Vue', (await transform(compiledRender, { loader: 'ts' })).code)(Vue)
const mintIssue = nftPaymentError({ tokenRequired: 210n, tokenBalance: 0n, tokenDecimals: 0, tokenSymbol: 'HBTC', nativeRequired: 2n, nativeBalance: 21n, nativeSymbol: 'ETH' })
const app = Vue.createSSRApp({ render, setup: () => ({
  error: '', loading: false, ready: true, side: 'buy', mode: 'mint', buyModes: [],
  state: { name: 'HBTC NFT', totalSupply: 5n, communityTokenPrice: 210n, communityDecimals: 0, communitySymbol: 'HBTC', whitelistRemaining: 0n, nativePrice: 2n, communityBalance: 0n, nativeBalance: 21n },
  mintArtwork: '', mintArtworkFallbacks: [], nativeSymbol: 'ETH', referrerTokenId: 0n,
  connected: true, mintNeedsApproval: false, mintIssue, action: '', walletDataReady: true,
  walletDataError: '', ownedNfts: [], transactions: [], transactionsLoading: false, hasMore: false,
  formatToken: String, formatEther: String, formatNative: String, executeMint() {},
}) })
app.component('NftArtwork', { render: () => null })
const html = await renderToString(app)
assert.match(html, /text-red-600[^>]*role="status"[^>]*>Insufficient HBTC/)
assert.match(html, /disabled[^>]*>Mint NFT/)
assert.match(html, /Wallet balance:/)
console.log('NFT mint UI: insufficient balance reason is visible in red next to a disabled action')
