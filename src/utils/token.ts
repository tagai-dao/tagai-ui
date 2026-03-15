import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { getChainById } from './privy';
import type { ParsedAsset } from './caip';

// ERC20 ABI (只包含需要的方法)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

export interface TokenInfo {
  chainId: number;
  symbol: string;
  decimals: number;
  address?: Address;
  isNative: boolean;
}

// 创建 public client 缓存
const publicClients: Record<number, PublicClient> = {};

function getPublicClient(chainId: number): PublicClient {
  if (!publicClients[chainId]) {
    const chain = getChainById(chainId);
    publicClients[chainId] = createPublicClient({
      chain,
      transport: http(),
    });
  }
  return publicClients[chainId];
}

// 原生代币符号映射
const NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH',
  56: 'BNB',
  8453: 'ETH',
  10: 'ETH',
  42161: 'ETH',
};

/**
 * 获取代币信息
 */
export async function getTokenInfo(parsed: ParsedAsset): Promise<TokenInfo> {
  const { chainId, namespace, address } = parsed;

  // 原生代币
  if (namespace === 'native') {
    return {
      chainId,
      symbol: NATIVE_SYMBOLS[chainId] || 'ETH',
      decimals: 18,
      isNative: true,
    };
  }

  // ERC20 代币
  if (!address) {
    throw new Error('ERC20 token requires address');
  }

  try {
    const client = getPublicClient(chainId);

    // 并行读取 symbol 和 decimals
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }) as Promise<string>,
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as Promise<number>,
    ]);

    return {
      chainId,
      symbol,
      decimals,
      address,
      isNative: false,
    };
  } catch (error) {
    console.error('Failed to fetch token info:', error);
    // 回退到默认值
    return {
      chainId,
      symbol: 'TOKEN',
      decimals: 18,
      address,
      isNative: false,
    };
  }
}

/**
 * 格式化代币金额（从 wei 到可读格式）
 */
export function formatTokenAmount(amount: string | bigint, decimals: number): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmed = fractionalStr.replace(/0+$/, '');
  return `${wholePart}.${trimmed}`;
}

/**
 * 解析代币金额（从可读格式到 wei）
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const parts = amount.split('.');
  const wholePart = parts[0] || '0';
  const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

  const wholeValue = BigInt(wholePart) * BigInt(10 ** decimals);
  const fractionalValue = BigInt(fractionalPart);

  return wholeValue + fractionalValue;
}

/**
 * 获取代币余额
 */
export async function getTokenBalance(
  chainId: number,
  tokenAddress: Address | undefined,
  ownerAddress: Address
): Promise<bigint> {
  const client = getPublicClient(chainId);

  // 原生代币余额
  if (!tokenAddress) {
    return await client.getBalance({ address: ownerAddress });
  }

  // ERC20 代币余额
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ownerAddress],
  }) as bigint;

  return balance;
}
