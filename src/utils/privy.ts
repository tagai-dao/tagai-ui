import Privy, { LocalStorage } from '@privy-io/js-sdk-core'
import { PrivyConfig, ChainConfig } from '@/config'
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

export const privy = new Privy({
  appId: PrivyConfig.appId,
  supportedChains: [customBsc],
  storage: new LocalStorage(),
  clientId: PrivyConfig.clientId,
})