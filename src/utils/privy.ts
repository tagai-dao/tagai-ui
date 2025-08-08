import Privy, { LocalStorage } from '@privy-io/js-sdk-core'
import { PrivyConfig, ChainConfig } from '@/config'
import { bsc } from 'viem/chains'

export const privy = new Privy({
  appId: PrivyConfig.appId,
  supportedChains: [bsc],
  storage: new LocalStorage(),
  clientId: PrivyConfig.clientId,
})