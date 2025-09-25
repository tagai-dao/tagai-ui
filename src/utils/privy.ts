import { bsc } from 'viem/chains'

export const customBsc = {
  ...bsc,
  rpcUrls: {
    default: {
      http: [
        'https://bsc-dataseed.binance.org',
        'https://rpc.ankr.com/bsc',
        'https://bsc.rpc.blxrbdn.com',
        'https://56.rpc.thirdweb.com',
      ]
    }
  }
}