/**
 * Nutbox indexers use both OPEN and OPENED for active pools.
 * Keep the menu and market filters identical, and reject unknown/closed states.
 * @param {import('../types/nutbox').NutboxPool | null | undefined} pool
 * @returns {boolean}
 */
export function isSupportedNutboxNftPool(pool) {
  return Boolean(
    pool
    && (pool.status === 'OPEN' || pool.status === 'OPENED')
    && pool.poolType === 'INDEX_BROKER_NFT'
    && pool.indexBroker?.pool
  )
}
