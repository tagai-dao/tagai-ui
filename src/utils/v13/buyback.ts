import { encodeAbiParameters, parseAbi, zeroAddress, type Address, type Hex } from 'viem'
import { getChainDeployment } from '@/config/chains'
import { getBasketProtocol } from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { getBasketDetail } from '@/utils/baskets/data'
import { quoteNutboxExactInput } from '@/utils/baskets/bsc-v3-routing'
import { quoteBasketBuyLegOutputs } from '@/utils/baskets/trade'
import { encodeBasketTradeData } from '@/utils/baskets/hook-data'
import { send, walletGuard } from './pools'

export const buybackAbi = parseAbi([
  'function listed() view returns(bool)',
  'function indexToken() view returns(address)',
  'function listingHook() view returns(address)',
  'function totalIndexRewardsNotified() view returns(uint256)',
  'function pendingBuybackReward(address) view returns(uint256)',
  'function claimBuybackReward(address) returns(uint256)',
  'function buybackBnbReserve(address) view returns(uint256)',
  'function executeBuyback(address,uint256,uint256,bytes) returns(uint256)',
  'function buybackRouter() view returns(address)',
  'function pump() view returns(address)',
  'function nutboxRouter() view returns(address)',
  'function basketRouter() view returns(address)',
  'function settlementToken() view returns(address)',
  'function balanceOf(address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function symbol() view returns(string)',
])
export type BuybackState = {
  token: Address; account: Address; index: Address; hook: Address; listed: boolean;
  reserve: bigint; notified: bigint; pending: bigint; rewardBalance: bigint;
  walletIndex: bigint; decimals: number; symbol: string; timestamp: bigint;
}
export async function readBuybackState(token: Address, account: Address = zeroAddress): Promise<BuybackState> {
  const client = getReadOnlyClient(56), block = await client.getBlock()
  const at = { abi: buybackAbi, blockNumber: block.number }
  const [listed, index, hook, notified, pending] = await Promise.all([
    client.readContract({ ...at, address: token, functionName: 'listed' }),
    client.readContract({ ...at, address: token, functionName: 'indexToken' }),
    client.readContract({ ...at, address: token, functionName: 'listingHook' }),
    client.readContract({ ...at, address: token, functionName: 'totalIndexRewardsNotified' }),
    account === zeroAddress ? 0n : client.readContract({ ...at, address: token, functionName: 'pendingBuybackReward', args: [account] }),
  ])
  const state: BuybackState = { token, account, listed, index, hook, notified, pending, reserve: 0n, rewardBalance: 0n, walletIndex: 0n, decimals: 18, symbol: '', timestamp: block.timestamp }
  if (index === zeroAddress || !listed) return state
  const [reserve, rewardBalance, walletIndex, decimals, symbol] = await Promise.all([
    client.readContract({ ...at, address: hook, functionName: 'buybackBnbReserve', args: [token] }),
    client.readContract({ ...at, address: index, functionName: 'balanceOf', args: [token] }),
    account === zeroAddress ? 0n : client.readContract({ ...at, address: index, functionName: 'balanceOf', args: [account] }),
    client.readContract({ ...at, address: index, functionName: 'decimals' }),
    client.readContract({ ...at, address: index, functionName: 'symbol' }),
  ])
  return { ...state, reserve, rewardBalance, walletIndex, decimals, symbol }
}

export function buybackMinimum(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 1 || bps > 1000) throw new Error('V13_BUYBACK_SLIPPAGE')
  const minimum = amount * BigInt(10000 - bps) / 10000n
  if (minimum <= 0n) throw new Error('V13_BUYBACK_TOO_SMALL')
  return minimum
}
export type BuybackQuote = {
  state: BuybackState; amountOut: bigint; minOut: bigint; minSettlement: bigint;
  data: Hex; deadline: bigint; fetchedAt: number; bps: number;
}
async function checkBuybackRouter() {
  const client = getReadOnlyClient(56), pump = getChainDeployment(56).contracts.pump13!
  const router = await client.readContract({ address: pump, abi: buybackAbi, functionName: 'buybackRouter' })
  if (router === zeroAddress) throw new Error('V13_BUYBACK_ROUTER')
  const protocol = getBasketProtocol(56, 4)
  const actual = await Promise.all((['pump', 'nutboxRouter', 'basketRouter', 'settlementToken'] as const).map(functionName => client.readContract({ address: router, abi: buybackAbi, functionName })))
  const expected = [pump, protocol.nutboxRouter, protocol.swapRouter, protocol.settlementToken]
  if (actual.some((a, i) => a.toLowerCase() !== expected[i]?.toLowerCase())) throw new Error('V13_BUYBACK_ROUTER')
}
export async function quoteBuyback(token: Address, account: Address, bps: number): Promise<BuybackQuote> {
  buybackMinimum(10000n, bps)
  const state = await readBuybackState(token, account)
  if (!state.listed || state.index === zeroAddress) throw new Error('V13_BUYBACK_PENDING')
  if (state.reserve <= 0n) throw new Error('V13_BUYBACK_EMPTY')
  await checkBuybackRouter()
  const detail = await getBasketDetail(state.index, 56)
  if (detail.version !== 4 || detail.holdings.length !== detail.basketLength || !detail.holdings.length) throw new Error('V13_BUYBACK_ROUTER')
  const settlement = await quoteNutboxExactInput(zeroAddress, getBasketProtocol(56, 4).settlementToken, state.reserve, 56, 4)
  const minSettlement = buybackMinimum(settlement, bps)
  // Protect every constituent even on the first mint. Use the minimum settlement
  // budget so the intermediate conversion's allowed movement does not break the legs.
  const outputs = await quoteBasketBuyLegOutputs({ chainId: 56, version: 4, settlementIn: minSettlement,
    basketFeeBps: detail.basketFeeBps, legs: detail.holdings.map(h => ({ asset: h.asset, route: h.route, weightBps: Math.round(h.targetWeightPct * 100) })),
  })
  const legMins = outputs.map(amount => buybackMinimum(amount, bps))
  const payload = (minimum: bigint) => encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], [minSettlement,
    encodeBasketTradeData({ chainId: 56, version: 4, side: 'buy', minOut: minimum, legCount: legMins.length, legMins, frontend: zeroAddress }),
  ])
  const client = getReadOnlyClient(56), deadline = (await client.getBlock()).timestamp + 180n
  // eth_call only: the actual Hook → adapter → Basket path produces the quote.
  // The permissive final bound is never returned as a sendable transaction.
  const preview = await client.simulateContract({ address: state.hook, abi: buybackAbi, functionName: 'executeBuyback', args: [token, 1n, deadline, payload(1n)], account })
  const amountOut = preview.result, minOut = buybackMinimum(amountOut, bps), data = payload(minOut)
  await client.simulateContract({ address: state.hook, abi: buybackAbi, functionName: 'executeBuyback', args: [token, minOut, deadline, data], account })
  return { state, amountOut, minOut, minSettlement, data, deadline, fetchedAt: Date.now(), bps }
}
export async function executeBuyback(quote: BuybackQuote) {
  const guard = walletGuard()
  if (guard.account.toLowerCase() !== quote.state.account.toLowerCase()) throw new Error('V13_ACCOUNT_CHANGED')
  const current = await readBuybackState(quote.state.token, guard.account)
  if (Date.now() - quote.fetchedAt > 60000 || current.timestamp >= quote.deadline || current.reserve !== quote.state.reserve
    || current.index.toLowerCase() !== quote.state.index.toLowerCase() || current.hook.toLowerCase() !== quote.state.hook.toLowerCase()) throw new Error('V13_BUYBACK_EXPIRED')
  await checkBuybackRouter()
  // Reserve is paid by the Hook; the connected wallet sends zero BNB.
  return send(current.hook, buybackAbi, 'executeBuyback', [current.token, quote.minOut, quote.deadline, quote.data], 0n, guard)
}
export async function claimIndexReward(token: Address) {
  const guard = walletGuard(), state = await readBuybackState(token, guard.account)
  if (state.pending <= 0n) throw new Error('V13_BUYBACK_NO_REWARD')
  return send(token, buybackAbi, 'claimBuybackReward', [guard.account], 0n, guard)
}
