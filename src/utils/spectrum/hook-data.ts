/**
 * mint/redeem hookData 编码 — frontend 槽位 = interface fee 收款地址
 * 移植自 Spectrum hook-data.ts（去掉 referral 覆盖）
 */
import { encodeAbiParameters, type Address, type Hex, zeroAddress } from 'viem'
import {
  SPECTRUM_DEFAULT_SLIPPAGE_BPS,
  SPECTRUM_FEE_WALLET,
  SPECTRUM_MAX_SLIPPAGE_BPS,
} from '@/config/spectrum'

export const clampSlippageBps = (bps: number): number => {
  if (!Number.isFinite(bps)) return SPECTRUM_DEFAULT_SLIPPAGE_BPS
  return Math.min(Math.max(Math.round(bps), 1), SPECTRUM_MAX_SLIPPAGE_BPS)
}

const BPS = 10_000n

/** legMins[i] = quotedLeg[i] × (1 − slippageBps/10000) */
export const deriveLegMins = (quotedLegAmounts: bigint[], slippageBps: number): bigint[] => {
  const s = BigInt(clampSlippageBps(slippageBps))
  return quotedLegAmounts.map((q) => (q * (BPS - s)) / BPS)
}

export type EncodedHookData = {
  hookData: Hex
  legMins: bigint[]
  minOut: bigint
  frontend: Address
}

/** 解析 interface tag：必须有有效 fee wallet，禁止静默用 0x0 假装有分成 */
export const resolveInterfaceTag = (): Address => {
  if (!SPECTRUM_FEE_WALLET) {
    throw new Error('Spectrum fee wallet is not configured')
  }
  return SPECTRUM_FEE_WALLET
}

export const encodeMintHookData = (input: {
  quotedLegAmounts: bigint[]
  slippageBps: number
  minOut: bigint
}): EncodedHookData => {
  const { quotedLegAmounts, minOut } = input
  if (quotedLegAmounts.length === 0) {
    throw new Error('hook-data: refusing to encode without live per-leg quotes')
  }
  if (quotedLegAmounts.some((q) => q <= 0n)) {
    throw new Error('hook-data: every leg must have a positive live quote')
  }
  const slippageBps = clampSlippageBps(input.slippageBps)
  const legMins = deriveLegMins(quotedLegAmounts, slippageBps)
  if (legMins.some((m) => m <= 0n)) {
    throw new Error('hook-data: a derived leg minimum rounded to zero')
  }
  const frontend = resolveInterfaceTag()
  const hookData = encodeAbiParameters(
    [
      { name: 'minOut', type: 'uint256' },
      { name: 'legMins', type: 'uint256[]' },
      { name: 'frontend', type: 'address' },
    ],
    [minOut, legMins, frontend],
  )
  return { hookData, legMins, minOut, frontend }
}

export const encodeRedeemHookData = (input: {
  legCount: number
  minOut: bigint
}): EncodedHookData => {
  if (!Number.isInteger(input.legCount) || input.legCount <= 0) {
    throw new Error('hook-data: redeem requires a positive on-chain leg count')
  }
  if (input.minOut <= 0n) {
    throw new Error('hook-data: redeem requires a positive aggregate minOut')
  }
  const legMins = new Array(input.legCount).fill(0n)
  const frontend = resolveInterfaceTag()
  const hookData = encodeAbiParameters(
    [
      { name: 'minOut', type: 'uint256' },
      { name: 'legMins', type: 'uint256[]' },
      { name: 'frontend', type: 'address' },
    ],
    [input.minOut, legMins, frontend],
  )
  return { hookData, legMins, minOut: input.minOut, frontend }
}

/** 仅用于类型/测试：零地址表示“无 interface 分成”（本项目交易路径不会走这里） */
export const ZERO_FRONTEND = zeroAddress
