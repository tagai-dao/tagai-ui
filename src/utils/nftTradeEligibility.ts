import { formatUnits } from 'viem'

export function nftPaymentError(input: {
  tokenRequired: bigint; tokenBalance: bigint; tokenDecimals: number; tokenSymbol: string;
  nativeRequired: bigint; nativeBalance: bigint; nativeSymbol: string;
}): string {
  const p = input
  if (p.tokenBalance < p.tokenRequired) {
    return `Insufficient ${p.tokenSymbol}: requires ${formatUnits(p.tokenRequired, p.tokenDecimals)}, but this wallet has ${formatUnits(p.tokenBalance, p.tokenDecimals)}.`
  }
  if (p.nativeBalance <= p.nativeRequired) {
    return `Insufficient ${p.nativeSymbol}: requires ${formatUnits(p.nativeRequired, 18)} plus gas. Wallet balance: ${formatUnits(p.nativeBalance, 18)} ${p.nativeSymbol}.`
  }
  return ''
}
