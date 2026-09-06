import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSupportedNutboxNftPool } from '../src/utils/nutboxPool.mjs'

const nft = {
  pool: '0x61791569eDF9D2090927BE59A66441E5ECF9e343',
  poolType: 'INDEX_BROKER_NFT',
  indexBroker: { pool: '0x61791569eDF9D2090927BE59A66441E5ECF9e343' },
}

test('Robinhood OPEN and legacy BSC OPENED pools appear in both menu and market', () => {
  for (const status of ['OPEN', 'OPENED']) {
    const pools = [{ ...nft, status }]
    assert.equal(pools.some(isSupportedNutboxNftPool), true)
    assert.deepEqual(pools.filter(isSupportedNutboxNftPool), pools)
  }
})

test('closed, paused, missing and unknown states stay hidden', () => {
  for (const status of ['CLOSED', 'CLOSE', 'PAUSED', '', undefined, null, 'UNKNOWN']) {
    assert.equal(isSupportedNutboxNftPool({ ...nft, status }), false)
  }
})

test('non-NFT and incomplete pools cannot enable an empty NFT market', () => {
  const open = { ...nft, status: 'OPEN' }
  for (const pool of [null, undefined, { ...open, poolType: 'SOCIAL_CURATION' },
    { ...open, indexBroker: undefined }, { ...open, indexBroker: {} },
    { ...open, indexBroker: { pool: '' } }]) {
    assert.equal(isSupportedNutboxNftPool(pool), false)
  }
})
