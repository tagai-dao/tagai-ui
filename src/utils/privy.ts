import {
  bsc,
  mainnet,
  base,
  optimism,
  arbitrum,
  bscTestnet,
  sepolia,
  type Chain
} from 'viem/chains'
import { defineChain } from 'viem'
import { BSC_CHAIN, ROBINHOOD_CHAIN, ROBINHOOD_TESTNET_CHAIN, getChainDeployment } from '@/config/chains'

/** BSC：多 RPC fallback */
export const customBsc = {
  ...bsc,
  rpcUrls: {
    default: {
      http: BSC_CHAIN.rpcUrls,
    }
  }
} as Chain

/** Robinhood Chain（Arbitrum Orbit L2） */
export const customRobinhood = defineChain({
  id: ROBINHOOD_CHAIN.chainId,
  name: ROBINHOOD_CHAIN.name,
  nativeCurrency: {
    name: ROBINHOOD_CHAIN.nativeCurrency.name,
    symbol: ROBINHOOD_CHAIN.nativeCurrency.symbol,
    decimals: ROBINHOOD_CHAIN.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: {
      http: ROBINHOOD_CHAIN.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: ROBINHOOD_CHAIN.browser.replace(/\/$/, ''),
    },
  },
})

export const customRobinhoodTestnet = defineChain({
  id: ROBINHOOD_TESTNET_CHAIN.chainId,
  name: ROBINHOOD_TESTNET_CHAIN.name,
  nativeCurrency: ROBINHOOD_TESTNET_CHAIN.nativeCurrency,
  rpcUrls: { default: { http: ROBINHOOD_TESTNET_CHAIN.rpcUrls } },
  blockExplorers: {
    default: { name: 'Blockscout', url: ROBINHOOD_TESTNET_CHAIN.browser.replace(/\/$/, '') },
  },
  testnet: true,
})

/** Privy / 钱包：产品链 + 少量测试网 */
export const supportedChains: Record<number, Chain> = {
  56: customBsc,
  4663: customRobinhood,
  46630: customRobinhoodTestnet,
  // 其它主网保留给未来 / DeFi 工具
  1: mainnet,
  8453: base,
  10: optimism,
  42161: arbitrum,
  97: bscTestnet,
  11155111: sepolia,
}

export function getChainById(chainId: number): Chain {
  const chain = supportedChains[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return chain
}

export function getChainName(chainId: number): string {
  try {
    return getChainDeployment(chainId).name
  } catch {
    const names: Record<number, string> = {
      56: 'BSC',
      4663: 'Robinhood',
      46630: 'Robinhood Testnet',
      1: 'Ethereum',
      8453: 'Base',
      10: 'Optimism',
      42161: 'Arbitrum',
      97: 'BSC Testnet',
      11155111: 'Sepolia',
    }
    return names[chainId] || `Chain ${chainId}`
  }
}

export function isChainSupported(chainId: number): boolean {
  return chainId in supportedChains
}
