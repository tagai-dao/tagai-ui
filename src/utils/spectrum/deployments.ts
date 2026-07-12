/**
 * Spectrum 链上部署地址（仅 Robinhood 4663）
 * 来源：Irora-dev/Spectrum app/src/lib/chain/deployments.json
 * 上线前请再对照官方源核对一次。
 */
import type { Address } from 'viem'
import { SPECTRUM_CHAIN_ID } from '@/config/spectrum'

export type SpectrumDeployment = {
  factory: Address
  usdc: Address
  /** 买卖入口；空字符串表示未配置，交易禁用 */
  swapRouter: Address | null
  poolManager: Address | null
  usdcSymbol: string
}

/** RH 部署表（与 Spectrum Mini 发布物对齐） */
export const SPECTRUM_DEPLOYMENTS: Record<typeof SPECTRUM_CHAIN_ID, SpectrumDeployment> = {
  [SPECTRUM_CHAIN_ID]: {
    factory: '0x91ca52C4095c795f6e05DABF7d53Db44101ef7A6',
    usdc: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    swapRouter: '0x10139577Eb5a710De69aE0fD60F9E881d39cb6bA',
    poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    usdcSymbol: 'USDC',
  },
}

export const getSpectrumDeployment = (chainId: number = SPECTRUM_CHAIN_ID): SpectrumDeployment | null => {
  if (chainId !== SPECTRUM_CHAIN_ID) return null
  return SPECTRUM_DEPLOYMENTS[SPECTRUM_CHAIN_ID]
}
