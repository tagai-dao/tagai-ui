/**
 * Spectrum V2 ABI 子集（发现 + 交易）
 * 移植自 Irora-dev/Spectrum abis-v2.ts — 只保留我们需要的 view / swap 面
 */
import { parseAbi } from 'viem'

const BASKET_ENTRY =
  '(address asset, uint8 venue, (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) ethPool, uint24 v3Fee, address v2Pair, uint16 weight, uint8 decimals)'

export const basketAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function basketLength() view returns (uint256)',
  `function basket(uint256) view returns ${BASKET_ENTRY}`,
  'function effectiveSupply() view returns (uint256)',
  'function idleHeld(address asset) view returns (uint256)',
  'function exchangeRate() view returns (uint256 rate1e18, bool fullyPriced)',
  'function totalReserve() view returns (uint256 usdcValue, bool fullyPriced)',
  'function quoteLeg(uint256 i) view returns (uint256 usdcValue, bool priced)',
  'function basketFeeBps() view returns (uint16)',
  'function creatorShareBps() view returns (uint16)',
  'function creatorPayout() view returns (address)',
  'function launcher() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
])

export const factoryAbi = parseAbi([
  'function allBaskets(uint256) view returns (address)',
  'function allBasketsLength() view returns (uint256)',
  'function tokens(address) view returns (address deployer)',
])

export const swapRouterAbi = parseAbi([
  'function swapExactIn(address basket, address tokenIn, uint256 amountIn, uint256 minOut, bytes hookData, address to) returns (uint256 amountOut)',
])

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])
