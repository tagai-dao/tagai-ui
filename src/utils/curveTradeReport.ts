import { parseAbiItem, parseEventLogs, type TransactionReceipt } from 'viem'

export const curveTradeEvent = parseAbiItem('event Trade(address indexed buyer, address indexed sellsman, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 tiptagFee, uint256 sellsmanFee)')

export function curveTradeReports(receipt: TransactionReceipt, token: string, timestamp: number) {
  if (receipt.status !== 'success') return []
  return parseEventLogs({ abi: [curveTradeEvent], logs: receipt.logs, strict: true })
    .filter(log => log.address.toLowerCase() === token.toLowerCase() && log.logIndex != null)
    .map(log => ({
      transHash: receipt.transactionHash,
      token: log.address,
      trader: log.args.buyer,
      isBuy: log.args.isBuy,
      tokenAmount: log.args.tokenAmount.toString(),
      ethAmount: log.args.ethAmount.toString(),
      blockNumber: Number(receipt.blockNumber),
      transactionIndex: receipt.transactionIndex,
      logIndex: log.logIndex!,
      timestamp,
    }))
}
