/**
 * Spectrum basket 买卖（approve + swapExactIn）
 */
import type { Address, Hex } from 'viem'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import {
  hasSpectrumFeeWallet,
  SPECTRUM_CHAIN_ID,
} from '@/config/spectrum'
import { getSpectrumDeployment } from './deployments'
import { erc20Abi, swapRouterAbi } from './abis'
import { encodeMintHookData, encodeRedeemHookData } from './hook-data'
import { friendlySpectrumRevert } from './decode-revert'
import type { TradeSide } from './swap-quote'
import type { SwapQuote } from './swap-quote'

export type SpectrumTradeParams = {
  side: TradeSide
  basket: Address
  quote: SwapQuote
  slippageBps: number
  account: Address
  chainId?: number
}

const assertTradeReady = (chainId: number) => {
  if (chainId !== SPECTRUM_CHAIN_ID) {
    throw new Error('Switch to Robinhood to trade baskets')
  }
  if (!hasSpectrumFeeWallet()) {
    throw new Error('Spectrum fee wallet is not configured')
  }
  const dep = getSpectrumDeployment(chainId)
  if (!dep?.swapRouter || !dep.usdc) {
    throw new Error('Spectrum swap router is not configured')
  }
  return dep
}

/** 查询 router 对 tokenIn 的 allowance */
export const getTradeAllowance = async (
  token: Address,
  owner: Address,
  chainId: number = SPECTRUM_CHAIN_ID,
): Promise<bigint> => {
  const dep = getSpectrumDeployment(chainId)
  if (!dep?.swapRouter) return 0n
  const client = getReadOnlyClient(chainId)
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, dep.swapRouter],
  })
}

/** 精确额度 approve（禁止无限授权） */
export const approveSpectrumTrade = async (
  token: Address,
  amount: bigint,
  account: Address,
  chainId: number = SPECTRUM_CHAIN_ID,
): Promise<Hex> => {
  const dep = assertTradeReady(chainId)
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const publicClient = getReadOnlyClient(chainId)

  try {
    await publicClient.simulateContract({
      account,
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [dep.swapRouter!, amount],
    })
  } catch (e) {
    throw new Error(friendlySpectrumRevert(e))
  }

  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [dep.swapRouter!, amount],
    account,
    chain: wallet.chain,
  })
  await waitForTx(hash)
  return hash
}

/** 执行 buy/sell */
export const executeSpectrumSwap = async (params: SpectrumTradeParams): Promise<Hex> => {
  const chainId = params.chainId ?? SPECTRUM_CHAIN_ID
  const dep = assertTradeReady(chainId)
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')

  const { side, basket, quote, slippageBps, account } = params
  const tokenIn = side === 'buy' ? dep.usdc : basket

  const encoded =
    side === 'buy'
      ? encodeMintHookData({
          quotedLegAmounts: quote.quotedLegAmounts,
          slippageBps,
          minOut: quote.minOutRaw,
        })
      : encodeRedeemHookData({
          legCount: quote.legCount,
          minOut: quote.minOutRaw,
        })

  const publicClient = getReadOnlyClient(chainId)
  try {
    await publicClient.simulateContract({
      account,
      address: dep.swapRouter!,
      abi: swapRouterAbi,
      functionName: 'swapExactIn',
      args: [basket, tokenIn, quote.amountRaw, quote.minOutRaw, encoded.hookData, account],
    })
  } catch (e) {
    throw new Error(friendlySpectrumRevert(e))
  }

  const hash = await wallet.writeContract({
    address: dep.swapRouter!,
    abi: swapRouterAbi,
    functionName: 'swapExactIn',
    args: [basket, tokenIn, quote.amountRaw, quote.minOutRaw, encoded.hookData, account],
    account,
    chain: wallet.chain,
  })
  await waitForTx(hash)
  return hash
}
