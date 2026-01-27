import type { Address } from 'viem';

// 1inch API endpoints (v5.2)
const ONEINCH_API_BASE = 'https://api.1inch.dev/swap/v5.2';

// 从环境变量读取 API Key
const ONEINCH_API_KEY = import.meta.env.VITE_ONEINCH_API_KEY;

// 是否使用 Mock 环境
// 优先级: 环境变量强制 > API Key 是否存在
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK_QUOTE === 'true';
const USE_MOCK_QUOTE = FORCE_MOCK || !ONEINCH_API_KEY;

// 调试日志
if (import.meta.env.DEV) {
  console.log('[DEX Config]', {
    forceMock: FORCE_MOCK,
    hasApiKey: !!ONEINCH_API_KEY,
    useMock: USE_MOCK_QUOTE,
  });
}

// 支持的链 ID 映射到 1inch 链 ID
const CHAIN_ID_MAP: Record<number, number> = {
  1: 1,      // Ethereum
  56: 56,    // BSC
  10: 10,    // Optimism
  42161: 42161, // Arbitrum
  8453: 8453,   // Base
};

/**
 * 辅助函数：创建带 API Key 的 fetch 请求
 */
function fetchWithApiKey(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (ONEINCH_API_KEY) {
    headers.set('Authorization', `Bearer ${ONEINCH_API_KEY}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

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
 * 检查是否需要授权
 */
export async function checkAllowance(
  chainId: number,
  tokenAddress: Address,
  ownerAddress: Address
): Promise<{ allowance: bigint; spender: Address }> {
  // 测试环境：假设已授权
  if (USE_MOCK_QUOTE) {
    console.log('[DEX] Using mock allowance check - assuming sufficient allowance');
    return {
      allowance: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'), // 最大值
      spender: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address, // PancakeSwap Router
    };
  }

  try {
    const oneInchChainId = CHAIN_ID_MAP[chainId];
    if (!oneInchChainId) {
      throw new Error(`Chain ${chainId} not supported by 1inch`);
    }

    // 获取 1inch 的 spender 地址
    const spenderUrl = `${ONEINCH_API_BASE}/${oneInchChainId}/approve/spender`;
    const spenderResponse = await fetchWithApiKey(spenderUrl);
    const spenderData = await spenderResponse.json();
    const spender = spenderData.address as Address;

    // 检查当前授权额度
    const allowanceUrl = `${ONEINCH_API_BASE}/${oneInchChainId}/approve/allowance?tokenAddress=${tokenAddress}&walletAddress=${ownerAddress}`;
    const allowanceResponse = await fetchWithApiKey(allowanceUrl);
    const allowanceData = await allowanceResponse.json();

    return {
      allowance: BigInt(allowanceData.allowance || '0'),
      spender,
    };
  } catch (error) {
    console.error('Failed to check allowance:', error);
    throw error;
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
  try {
    const oneInchChainId = CHAIN_ID_MAP[chainId];
    if (!oneInchChainId) {
      throw new Error(`Chain ${chainId} not supported by 1inch`);
    }

    // 安全: 验证授权金额必须指定
    if (!amount || amount === '0') {
      throw new Error('Approval amount must be specified for security');
    }

    const url = `${ONEINCH_API_BASE}/${oneInchChainId}/approve/transaction?tokenAddress=${tokenAddress}&amount=${amount}`;
    const response = await fetchWithApiKey(url);
    const data = await response.json();

    return {
      to: data.to,
      data: data.data,
      value: data.value || '0',
    };
  } catch (error) {
    console.error('Failed to build approval transaction:', error);
    throw error;
  }
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
  // 测试环境：使用 mock 报价
  if (USE_MOCK_QUOTE) {
    console.log('[DEX] Using mock quote for testing');

    // Mock 汇率：BNB/USDT ≈ 600, ETH/USDC ≈ 3000
    const fromAmount = BigInt(amount);
    let mockRate = 1.0;
    let mockRoute = 'PancakeSwap V2';

    // 简单的 mock 逻辑
    if (fromTokenAddress === 'native' && chainId === 56) {
      // BNB → USDT
      mockRate = 600.0;
      mockRoute = 'PancakeSwap V2';
    } else if (fromTokenAddress !== 'native' && toTokenAddress === 'native' && chainId === 56) {
      // USDT → BNB
      mockRate = 1 / 600.0;
      mockRoute = 'PancakeSwap V2';
    } else if (fromTokenAddress === 'native' && chainId === 1) {
      // ETH → USDC
      mockRate = 3000.0;
      mockRoute = 'Uniswap V3';
    }

    // 计算买入数量（考虑decimals差异）
    // BNB (18 decimals) → USDT (18 decimals)
    const toAmount = BigInt(Math.floor(Number(fromAmount) * mockRate));

    return {
      buyAmount: toAmount.toString(),
      estimatedGas: '200000',
      rate: mockRate.toFixed(6),
      priceImpact: '0.1',
      minimumReceived: (Number(toAmount) * 0.995).toFixed(0), // 0.5% slippage
      route: mockRoute,
    };
  }

  // 真实环境：调用 1inch API
  try {
    const oneInchChainId = CHAIN_ID_MAP[chainId];
    if (!oneInchChainId) {
      throw new Error(`Chain ${chainId} not supported by 1inch`);
    }

    // 1inch 使用 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE 表示原生代币
    const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const fromToken = fromTokenAddress === 'native' ? NATIVE_TOKEN : fromTokenAddress;
    const toToken = toTokenAddress === 'native' ? NATIVE_TOKEN : toTokenAddress;

    const url = `${ONEINCH_API_BASE}/${oneInchChainId}/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`;
    const response = await fetchWithApiKey(url);

    if (!response.ok) {
      throw new Error(`Failed to get quote: ${response.statusText}`);
    }

    const data = await response.json();

    // 计算汇率
    const fromAmount = BigInt(amount);
    const toAmount = BigInt(data.toAmount);
    const rate = (Number(toAmount) / Number(fromAmount)).toFixed(6);

    return {
      buyAmount: data.toAmount,
      estimatedGas: data.estimatedGas || '0',
      rate,
      // 1inch API 可能不直接提供这些字段，需要计算
      priceImpact: undefined,
      minimumReceived: undefined,
      route: data.protocols?.[0]?.map((p: any) => p[0]?.name).join(' → '),
    };
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    throw error;
  }
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
  // 测试环境：使用 mock 交易（实际上不会执行，只用于UI测试）
  if (USE_MOCK_QUOTE) {
    console.log('[DEX] Using mock swap transaction for testing');
    console.warn('[DEX] Mock swap - 实际交易不会执行，仅用于 UI 测试');

    // 返回一个假的交易数据（PancakeSwap Router V2 地址）
    return {
      to: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address, // PancakeSwap Router
      data: '0x' as `0x${string}`, // 空数据，不会真正执行
      value: fromTokenAddress === 'native' ? amount : '0',
    };
  }

  // 真实环境：调用 1inch API
  try {
    const oneInchChainId = CHAIN_ID_MAP[chainId];
    if (!oneInchChainId) {
      throw new Error(`Chain ${chainId} not supported by 1inch`);
    }

    const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const fromToken = fromTokenAddress === 'native' ? NATIVE_TOKEN : fromTokenAddress;
    const toToken = toTokenAddress === 'native' ? NATIVE_TOKEN : toTokenAddress;

    const url = `${ONEINCH_API_BASE}/${oneInchChainId}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${fromAddress}&slippage=${slippage}&disableEstimate=true`;

    const response = await fetchWithApiKey(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Failed to build swap transaction');
    }

    const data = await response.json();

    return {
      to: data.tx.to,
      data: data.tx.data,
      value: data.tx.value || '0',
    };
  } catch (error) {
    console.error('Failed to build swap transaction:', error);
    throw error;
  }
}

/**
 * 检查链是否支持
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId in CHAIN_ID_MAP;
}
