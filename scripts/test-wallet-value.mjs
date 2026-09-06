import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateWalletUsd } from '../src/utils/walletValue.mjs'

test('native-only BNB and ETH wallets have USD value without token holdings', () => {
  assert.equal(calculateWalletUsd(2, 600, []), 1200)
  assert.equal(calculateWalletUsd(0.5, 2000, []), 1000)
})
test('price/holdings arriving later recalculate without retaining initial zero', () => {
  assert.equal(calculateWalletUsd(2, 0), null)
  assert.equal(calculateWalletUsd(2, '600'), 1200)
  assert.equal(calculateWalletUsd(2, 600, [{ amount: 10n ** 18n, price: 0.1 }]), 1260)
})
test('respect token decimals and ignore invalid pricing instead of NaN', () => {
  assert.equal(calculateWalletUsd(0, 1000, [{ amount: '1000000', price: 0.001, decimals: 6 }, { amount: 10, price: undefined }]), 1)
  assert.equal(calculateWalletUsd(0, 1000), 0)
  assert.equal(calculateWalletUsd(2, NaN), null)
})
