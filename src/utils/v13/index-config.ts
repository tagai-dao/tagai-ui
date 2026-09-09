import type { V13IndexConfig } from '@/types'
import { isAddress, zeroAddress } from 'viem'
export type IndexConfigErrorCode = 'required' | 'name' | 'assets' | 'weights' | 'fee' | 'creatorShare'
export class IndexConfigValidationError extends Error {
  constructor(readonly code: IndexConfigErrorCode, message: string) {
    super(message)
    this.name = 'IndexConfigValidationError'
  }
  get messageKey() { return `v13Create.validation.${this.code}` }
}
export function validateIndexConfig(config?: V13IndexConfig): asserts config is V13IndexConfig {
  if (!config) throw new IndexConfigValidationError('required', 'Index configuration is required')
  const bytes = (s: string) => new TextEncoder().encode(s).length
  if (!config.name.trim() || bytes(config.name) > 64 || !config.symbol.trim() || bytes(config.symbol) > 16) throw new IndexConfigValidationError('name', 'Index name: 1–64 bytes; symbol: 1–16 bytes')
  const assets = config.constituentAssets
  if (assets.length < 1 || assets.length > 4 || assets.some(a => !isAddress(a) || a.toLowerCase() === zeroAddress) || new Set(assets.map(a => a.toLowerCase())).size !== assets.length) throw new IndexConfigValidationError('assets', 'Choose 1–4 distinct constituent assets')
  if (config.targetWeights.length !== assets.length || config.targetWeights.some(w => !Number.isInteger(w) || w <= 0) || config.targetWeights.reduce((a,b) => a+b,0) !== 10000) throw new IndexConfigValidationError('weights', 'Constituent weights must total 100%')
  if (!Number.isInteger(config.basketFeeBps) || config.basketFeeBps < 100 || config.basketFeeBps > 300) throw new IndexConfigValidationError('fee', 'Index fee must be 1–3%')
  if (!Number.isInteger(config.creatorShareBps) || config.creatorShareBps < 0 || config.creatorShareBps > 3000) throw new IndexConfigValidationError('creatorShare', 'Creator share must be 0–30%')
}
