export function calculateWalletUsd(nativeBalance, nativeUsdPrice, holdings = []) {
  const usd = Number(nativeUsdPrice)
  if (!Number.isFinite(usd) || usd <= 0) return null
  const native = Number(nativeBalance)
  let total = Number.isFinite(native) && native >= 0 ? native * usd : 0
  for (const item of holdings) {
    const decimals = Number(item.decimals ?? item.community?.decimals ?? 18)
    const amount = Number(item.amount) / 10 ** decimals
    const price = Number(item.price)
    if (Number.isFinite(amount) && amount >= 0 && Number.isFinite(price) && price >= 0) total += amount * price * usd
  }
  return total
}
