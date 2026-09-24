import { getChainDeployment } from '@/config/chains'
import { IndexConfigValidationError } from '../v13/index-config'
import type { CreationOptions } from '../v13/creation'

export function validTradePool(value: any): value is CreationOptions['tradePool'] {
  return typeof value?.factory === 'string' && value.factory.toLowerCase() === getChainDeployment(56).contracts.tradeCurationFactory?.toLowerCase()
    && typeof value.enabled === 'boolean' && Number.isInteger(value.maxRewardRatio)
    && value.maxRewardRatio >= 0 && value.maxRewardRatio <= 8000
    && (!value.enabled || value.maxRewardRatio > 0)
}

/** Factory and availability come from the current chain snapshot, never a saved draft. */
export function tradePoolConfig(ratio: number, options?: CreationOptions) {
  if (!Number.isInteger(ratio) || ratio < 0 || ratio > 8000) {
    throw new IndexConfigValidationError('tradeRatio', 'Trade mining share must be 0.01–80%')
  }
  if (ratio === 0) return []
  if (!options || !validTradePool(options.tradePool) || !options.tradePool.enabled) {
    throw new IndexConfigValidationError('tradeUnavailable', 'Trade mining is currently unavailable')
  }
  if (ratio > options.tradePool.maxRewardRatio) {
    throw new IndexConfigValidationError('tradeRatio', 'Trade mining share exceeds the current limit')
  }
  return [{ factory: options.tradePool.factory, rewardRatio: ratio, meta: '0x' as const }]
}

/** Same cumulative integer rounding as Pump14._poolRatios. */
export function stakingRewardRatios(weights: number[], tradeRatio: number): number[] {
  let cumulative = 0, previous = 0
  return weights.map(weight => {
    cumulative += weight
    const allocated = Math.floor(cumulative * (10000 - tradeRatio) / 10000)
    const ratio = allocated - previous
    previous = allocated
    return ratio
  })
}
