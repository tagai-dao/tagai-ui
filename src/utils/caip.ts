// CAIP-19 Asset Type and Identifier Utilities
// Reference: https://chainagnostic.org/CAIPs/caip-19

import type { Address } from 'viem';
import { isAddress } from 'viem';

/**
 * Parsed CAIP-19 asset
 */
export interface ParsedAsset {
  chainId: number;
  namespace: 'erc20' | 'native';
  address?: Address;
}

/**
 * Parse CAIP-19 asset identifier
 *
 * Format: chain_id + "/" + asset_namespace + ":" + asset_reference
 * Examples:
 * - ERC20: "eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955"
 * - Native: "eip155:56/native"
 *
 * @param assetId CAIP-19 asset identifier string
 * @returns Parsed asset object
 * @throws Error if format is invalid
 */
export function parseCAIP19(assetId: string): ParsedAsset {
  // Match format: eip155:<chainId>/<namespace>(:<address>)?
  const match = assetId.match(/^eip155:(\d+)\/(erc20|native)(?::(.+))?$/);

  if (!match) {
    throw new Error(`Invalid CAIP-19 format: ${assetId}. Expected format: eip155:<chainId>/<namespace>(:<address>)?`);
  }

  const [, chainIdStr, namespace, address] = match;
  const chainId = parseInt(chainIdStr, 10);

  // Validate namespace and address combination
  if (namespace === 'erc20') {
    if (!address) {
      throw new Error(`ERC20 asset must include address: ${assetId}`);
    }
    if (!isAddress(address)) {
      throw new Error(`Invalid ERC20 address: ${address}`);
    }
    return {
      chainId,
      namespace: 'erc20',
      address: address as Address,
    };
  } else {
    // native token
    if (address) {
      throw new Error(`Native asset should not include address: ${assetId}`);
    }
    return {
      chainId,
      namespace: 'native',
    };
  }
}

/**
 * Create CAIP-19 asset identifier from components
 *
 * @param chainId Chain ID (e.g., 56 for BSC)
 * @param namespace Asset namespace ('erc20' or 'native')
 * @param address Token address (required for erc20, must be omitted for native)
 * @returns CAIP-19 asset identifier string
 */
export function createCAIP19(
  chainId: number,
  namespace: 'erc20' | 'native',
  address?: Address
): string {
  if (namespace === 'erc20') {
    if (!address) {
      throw new Error('ERC20 asset requires address');
    }
    if (!isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    return `eip155:${chainId}/erc20:${address}`;
  } else {
    if (address) {
      throw new Error('Native asset should not have address');
    }
    return `eip155:${chainId}/native`;
  }
}

/**
 * Validate CAIP-19 asset identifier format
 *
 * @param assetId Asset identifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidCAIP19(assetId: string): boolean {
  try {
    parseCAIP19(assetId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable description of the asset
 *
 * @param assetId CAIP-19 asset identifier
 * @returns Description string
 */
export function getAssetDescription(assetId: string): string {
  try {
    const asset = parseCAIP19(assetId);
    const chainNames: Record<number, string> = {
      1: 'Ethereum',
      56: 'BSC',
      8453: 'Base',
      10: 'Optimism',
      42161: 'Arbitrum',
    };
    const chainName = chainNames[asset.chainId] || `Chain ${asset.chainId}`;

    if (asset.namespace === 'native') {
      return `Native ${chainName} token`;
    } else {
      return `ERC20 token on ${chainName} (${asset.address})`;
    }
  } catch (error) {
    return 'Unknown asset';
  }
}

/**
 * Common asset identifiers for convenience
 */
export const COMMON_ASSETS = {
  // BSC (Chain ID: 56)
  BSC_BNB: 'eip155:56/native',
  BSC_USDT: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
  BSC_USDC: 'eip155:56/erc20:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BSC_BUSD: 'eip155:56/erc20:0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',

  // Ethereum (Chain ID: 1)
  ETH: 'eip155:1/native',
  ETH_USDT: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
  ETH_USDC: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',

  // Base (Chain ID: 8453)
  BASE_ETH: 'eip155:8453/native',
  BASE_USDC: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

  // Optimism (Chain ID: 10)
  OP_ETH: 'eip155:10/native',
  OP_USDC: 'eip155:10/erc20:0x7F5c764cBc14f9669B88837ca1490cCa17c31607',

  // Arbitrum (Chain ID: 42161)
  ARB_ETH: 'eip155:42161/native',
  ARB_USDC: 'eip155:42161/erc20:0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
} as const;
