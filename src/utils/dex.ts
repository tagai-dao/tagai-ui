import type { Address } from 'viem';
import { encodeFunctionData } from 'viem';
import { readContract } from './contract';
import { WETH, uniswapV2Router02 } from '@/config';

export interface SwapQuote {
  buyAmount: string;
  estimatedGas: string;
  rate: string;
  priceImpact?: string;
  minimumReceived?: string;
  route?: string;
}

export interface SwapTransaction {
  to: Address;
  data: `0x${string}`;
  value: string;
}

/**
 * 检查是否需要授权（从链上读取 ERC20 allowance）
 */
export async function checkAllowance(
  chainId: number,
  tokenAddress: Address,
  ownerAddress: Address
): Promise<{ allowance: bigint; spender: Address }> {
  const spender = uniswapV2Router02 as Address;
  if (chainId !== 56) {
    return { allowance: 0n, spender };
  }
  try {
    const allowance = await readContract(
      'Token1',
      'allowance',
      [ownerAddress, spender],
      tokenAddress as `0x${string}`
    );
    return {
      allowance: BigInt(allowance as bigint),
      spender,
    };
  } catch (e) {
    console.error('[DEX] Failed to check allowance:', e);
    return { allowance: 0n, spender };
  }
}

/**
 * 构建授权交易
 * 安全: 必须指定授权金额，不再支持无限授权
 */
export async function buildApprovalTransaction(
  chainId: number,
  tokenAddress: Address,
  amount: string // 安全: 改为必需参数，强制调用者指定金额
): Promise<SwapTransaction> {
  // 仅支持 BSC 主网链 ID 56，保持与 TagAI 主链一致
  if (chainId !== 56) {
    throw new Error(`buildApprovalTransaction only supports BSC (56), got ${chainId}`);
  }

  if (!amount || amount === '0') {
    throw new Error('Approval amount must be specified for security');
  }

  // 使用标准 ERC20 approve(spender, amount)
  const data = encodeFunctionData({
    abi: [
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ],
    functionName: 'approve',
    args: [uniswapV2Router02 as Address, BigInt(amount)],
  });

  return {
    to: tokenAddress,
    data: data as `0x${string}`,
    value: '0',
  };
}

/**
 * 获取 swap 报价
 */
export async function getSwapQuote(
  chainId: number,
  fromTokenAddress: Address | 'native',
  toTokenAddress: Address | 'native',
  amount: string
): Promise<SwapQuote> {
  // 仅支持 BSC 主网，严格按照 TagAI 原生逻辑
  if (chainId !== 56) {
    throw new Error(`getSwapQuote only supports BSC (56), got ${chainId}`);
  }

  const fromAmount = BigInt(amount);
  if (fromAmount === 0n) {
    return {
      buyAmount: '0',
      estimatedGas: '0',
      rate: '0',
      priceImpact: undefined,
      minimumReceived: undefined,
      route: 'PancakeSwap V2',
    };
  }

  // 构造路径：native 用 WETH 替代
  const from = fromTokenAddress === 'native' ? (WETH as Address) : fromTokenAddress;
  const to = toTokenAddress === 'native' ? (WETH as Address) : toTokenAddress;

  let path: Address[];
  if (from === WETH && to === WETH) {
    // BNB → BNB 理论上不会发生
    path = [WETH as Address];
  } else if (from === WETH || to === WETH) {
    // BNB ↔ ERC20
    path = [from, to];
  } else {
    // ERC20 ↔ ERC20，简单通过 WETH 中转
    path = [from, WETH as Address, to];
  }

  // 使用 Router 的 getAmountsOut 计算链上价格
  const amounts: bigint[] = await readContract('UniswapRouter', 'getAmountsOut', [fromAmount, path]);
  const toAmount = amounts[amounts.length - 1];

  const rate = Number(toAmount) / Number(fromAmount || 1n);

  return {
    buyAmount: toAmount.toString(),
    // 估一个保守的 gas，上层会再调用 estimateGas
    estimatedGas: '250000',
    rate: rate.toFixed(6),
    // 这里暂不计算真实 priceImpact，仅给出最小接收量（0.5% 滑点）
    priceImpact: undefined,
    minimumReceived: (Number(toAmount) * 0.995).toFixed(0),
    route: 'PancakeSwap V2',
  };
}

/**
 * 构建 swap 交易
 */
export async function buildSwapTransaction(
  chainId: number,
  fromTokenAddress: Address | 'native',
  toTokenAddress: Address | 'native',
  amount: string,
  fromAddress: Address,
  slippage: number = 1 // 1% slippage
): Promise<SwapTransaction> {
  if (chainId !== 56) {
    throw new Error(`buildSwapTransaction only supports BSC (56), got ${chainId}`);
  }

  const amountIn = BigInt(amount);
  if (amountIn === 0n) {
    throw new Error('Swap amount must be greater than 0');
  }

  const from = fromTokenAddress === 'native' ? (WETH as Address) : fromTokenAddress;
  const to = toTokenAddress === 'native' ? (WETH as Address) : toTokenAddress;

  let path: Address[];
  if (from === WETH && to === WETH) {
    throw new Error('Swap path WETH→WETH is not valid');
  } else if (from === WETH || to === WETH) {
    path = [from, to];
  } else {
    path = [from, WETH as Address, to];
  }

  // 先用 Router 计算输出，再按 slippage 计算最小接收量
  const amounts: bigint[] = await readContract('UniswapRouter', 'getAmountsOut', [amountIn, path]);
  const amountOut = amounts[amounts.length - 1];
  const amountOutMin = (amountOut * BigInt(10000 - Math.floor(slippage * 100))) / 10000n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10); // 10 分钟

  let data: `0x${string}`;
  let value = '0';

  if (fromTokenAddress === 'native') {
    // BNB → Token: swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline)
    data = encodeFunctionData({
      abi: [
        {
          name: 'swapExactETHForTokens',
          type: 'function',
          stateMutability: 'payable',
          inputs: [
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'path', type: 'address[]' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
          ],
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
        },
      ],
      functionName: 'swapExactETHForTokens',
      args: [amountOutMin, path, fromAddress, deadline],
    }) as `0x${string}`;
    value = amountIn.toString();
  } else if (toTokenAddress === 'native') {
    // Token → BNB: swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
    data = encodeFunctionData({
      abi: [
        {
          name: 'swapExactTokensForETH',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'path', type: 'address[]' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
          ],
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
        },
      ],
      functionName: 'swapExactTokensForETH',
      args: [amountIn, amountOutMin, path, fromAddress, deadline],
    }) as `0x${string}`;
    value = '0';
  } else {
    // Token → Token: swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
    data = encodeFunctionData({
      abi: [
        {
          name: 'swapExactTokensForTokens',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'path', type: 'address[]' },
            { name: 'to', type: 'address' },
            { name: 'deadline', type: 'uint256' },
          ],
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
        },
      ],
      functionName: 'swapExactTokensForTokens',
      args: [amountIn, amountOutMin, path, fromAddress, deadline],
    }) as `0x${string}`;
    value = '0';
  }

  return {
    to: uniswapV2Router02 as Address,
    data,
    value,
  };
}

/**
 * 检查链是否支持
 */
export function isSupportedChain(chainId: number): boolean {
  // 目前仅支持 BSC 主网，用于 Mainnet DeFi 测试
  return chainId === 56;
}
