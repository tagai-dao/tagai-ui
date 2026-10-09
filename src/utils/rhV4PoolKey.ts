import { encodeAbiParameters, isAddress, keccak256 } from 'viem'

export type RhV4PoolKey = {
  currency0: `0x${string}`
  currency1: `0x${string}`
  fee: number
  tickSpacing: number
  hooks: `0x${string}`
}

const unavailable = () => new Error('RH_V4_POOL_KEY_UNAVAILABLE')

export const normalizeRhV4PoolKey = (value: unknown): RhV4PoolKey => {
  if (!value || typeof value !== 'object') throw unavailable()
  const key = value as RhV4PoolKey
  if (![key.currency0, key.currency1, key.hooks].every(address => typeof address === 'string' && isAddress(address)) ||
      BigInt(key.currency0) >= BigInt(key.currency1) || !Number.isInteger(key.fee) || key.fee < 0 || key.fee > 0xffffff ||
      !Number.isInteger(key.tickSpacing) || key.tickSpacing <= 0 || key.tickSpacing > 32767) throw unavailable()
  return { currency0: key.currency0, currency1: key.currency1, fee: key.fee, tickSpacing: key.tickSpacing, hooks: key.hooks }
}

export const rhV4PoolKeyToId = (key: RhV4PoolKey): `0x${string}` => keccak256(encodeAbiParameters(
  [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
  [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
))

export const verifyRhV4PoolKey = (poolId: string, value: unknown, token?: string): RhV4PoolKey => {
  const key = normalizeRhV4PoolKey(value)
  if (!/^0x[0-9a-f]{64}$/i.test(poolId) || rhV4PoolKeyToId(key) !== poolId.toLowerCase() ||
      (token && ![key.currency0, key.currency1].some(c => c.toLowerCase() === token.toLowerCase()))) throw unavailable()
  return key
}

/** Frontend metadata comes only from the API, never from history or guessed deployment templates. */
export const createRhV4PoolKeyReader = (
  fetchMetadata: (chainId: number, poolId: string) => Promise<unknown>,
) => {
  const cache = new Map<string, Promise<RhV4PoolKey>>()
  return (chainId: number, poolId: string): Promise<RhV4PoolKey> => {
    if (!/^0x[0-9a-f]{64}$/i.test(poolId)) return Promise.reject(unavailable())
    const id = poolId.toLowerCase()
    const scope = `${chainId}:${id}`
    const cached = cache.get(scope)
    if (cached) return cached
    const loading = (async () => {
      try {
        const result = await fetchMetadata(chainId, id) as { chainId?: number; poolId?: string; poolKey?: unknown }
        if (Number(result?.chainId) !== chainId || result.poolId?.toLowerCase() !== id) throw unavailable()
        return verifyRhV4PoolKey(id, result.poolKey)
      } catch { throw unavailable() }
    })()
    cache.set(scope, loading)
    void loading.catch(() => cache.delete(scope))
    return loading
  }
}
