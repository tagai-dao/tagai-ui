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
import { BSC_CHAIN, ROBINHOOD_CHAIN, getChainDeployment } from '@/config/chains'

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
  // viem multicall 依赖；与 chains.ts MULTICALL3 一致
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
})

/** Privy / 钱包：产品链 + 少量测试网 */
export const supportedChains: Record<number, Chain> = {
  56: customBsc,
  4663: customRobinhood,
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
