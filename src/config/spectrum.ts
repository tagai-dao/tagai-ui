/**
 * Spectrum Baskets（Robinhood）集成配置
 * - 产品内称 Baskets，不使用 “Spectrum…” 作产品名
 * - fee wallet 打到 hookData.frontend，拿 interface kickback
 */
import { isAddress, zeroAddress, type Address } from 'viem'
import { FeeAddress } from '@/config'

/** Spectrum 仅接 RH */
export const SPECTRUM_CHAIN_ID = 4663 as const

/**
 * Interface fee 收款地址。
 * 优先 VITE_SPECTRUM_FEE_WALLET；否则回退到 TagAI 现有 FeeAddress。
 * 空 / 非法 / 零地址 → 禁止交易。
 */
const envFee = (import.meta.env.VITE_SPECTRUM_FEE_WALLET as string | undefined)?.trim()

export const SPECTRUM_FEE_WALLET: Address | null = (() => {
  const raw = envFee || FeeAddress
  if (!raw || !isAddress(raw)) return null
  if (raw.toLowerCase() === zeroAddress) return null
  return raw as Address
})()

export const hasSpectrumFeeWallet = (): boolean => SPECTRUM_FEE_WALLET != null

/** 默认滑点 1%，UI 上限 5%（对齐 Spectrum） */
export const SPECTRUM_DEFAULT_SLIPPAGE_BPS = 100
export const SPECTRUM_MAX_SLIPPAGE_BPS = 500

/** USDC 结算资产小数位 */
export const SPECTRUM_USDC_DECIMALS = 6

export const SPECTRUM_MINI_ATTRIBUTION = 'Powered by Spectrum Mini'
export const SPECTRUM_REPO_URL = 'https://github.com/Irora-dev/Spectrum'
