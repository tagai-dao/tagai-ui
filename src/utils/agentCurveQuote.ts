import { getReadOnlyClient } from '@/utils/wallets'
import { getIndexDeployment } from '@/utils/v14/chain'
import { type Address, parseEther } from 'viem'
import type { AgentBuyEstimate } from './agentTradePrompt'

const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address
const CAP = parseEther('650000000')
/** Wallet-independent reference quote; no balances, Handle checks or transactions. */
export async function quoteAgentCurveBuy(token: Address, version: number, amountIn: bigint): Promise<AgentBuyEstimate> {
  if (![15,16,17,18].includes(version) || amountIn <= 0n) throw Error('INVALID_AMOUNT')
  const client = getReadOnlyClient(56), deployment = getIndexDeployment(56, version)
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
  const [listed, pending, supply, fees, limit] = await client.multicall({ blockNumber, multicallAddress: MULTICALL, allowFailure: false, batchSize: 0,
    contracts: ['listed','listingPending','bondingCurveSupply','getBuyFeeRatios', ...(version >= 17 ? ['INNER_MARKET_BUY_LIMIT'] : [])].map(functionName => ({ address: token, abi: deployment.tokenAbi, functionName })) })
  if (listed || pending) throw Error('MARKET_CHANGED')
  const [platform, referral] = fees as readonly [bigint, bigint]
  if (typeof supply !== 'bigint' || supply >= CAP || platform < 0n || referral < 0n || platform + referral >= 10000n) throw Error('QUOTE_UNAVAILABLE')
  const net = amountIn - amountIn * platform / 10000n - amountIn * referral / 10000n
  const [quoted, issued] = await client.multicall({ blockNumber, multicallAddress: MULTICALL, allowFailure: false, batchSize: 0, contracts: [
    { address: deployment.pump, abi: deployment.pumpAbi, functionName: 'getBuyAmountByValue', args: [supply, net] },
    { address: deployment.pump, abi: deployment.pumpAbi, functionName: 'createdTokens', args: [token] },
  ] })
  if (issued !== true || typeof quoted !== 'bigint' || quoted <= 0n) throw Error('QUOTE_UNAVAILABLE')
  const amountOut = quoted > CAP - supply ? CAP - supply : quoted
  if (version >= 17 && (typeof limit !== 'bigint' || amountOut > limit)) throw Error('BUY_LIMIT_EXCEEDED')
  return { chainId: 56, token, version, amountIn, amountOut, blockNumber, quotedAt: Date.now() }
}
