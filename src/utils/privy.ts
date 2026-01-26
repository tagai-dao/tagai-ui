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

// Custom BSC configuration with multiple RPC endpoints
export const customBsc = {
  ...bsc,
  rpcUrls: {
    default: {
      http: [
        'https://bsc-dataseed.binance.org',
        'https://rpc.ankr.com/bsc',
        'https://bsc.rpc.blxrbdn.com',
        'https://56.rpc.thirdweb.com',
      ]
    }
  }
}

// Supported chains configuration for DeFi Actions
export const supportedChains: Record<number, Chain> = {
  // Mainnets
  56: customBsc,      // BSC
  1: mainnet,         // Ethereum Mainnet
  8453: base,         // Base
  10: optimism,       // Optimism
  42161: arbitrum,    // Arbitrum
  // Testnets
  97: bscTestnet,     // BSC Testnet
  11155111: sepolia,  // Sepolia
}

// Get chain configuration by chain ID
export function getChainById(chainId: number): Chain {
  const chain = supportedChains[chainId]
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return chain
}

// Get chain name by chain ID
export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    // Mainnets
    56: 'BSC',
    1: 'Ethereum',
    8453: 'Base',
    10: 'Optimism',
    42161: 'Arbitrum',
    // Testnets
    97: 'BSC Testnet',
    11155111: 'Sepolia',
  }
  return names[chainId] || `Chain ${chainId}`
}

// Check if chain is supported
export function isChainSupported(chainId: number): boolean {
  return chainId in supportedChains
}