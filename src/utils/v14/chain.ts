import { getChainDeployment } from '@/config/chains'
import { type Abi, type Address } from 'viem'
import bscPump from './Pump14.json'
import rhPump from './RHPumpV14.json'
import bscToken from '../v13/Token13.json'
import rhToken from './RHTokenV14.json'

export const isIndexToken = (chainId: number, version: unknown) =>
  chainId === 56 ? [13,14].includes(Number(version)) : chainId === 4663 && Number(version) === 14

export function getIndexDeployment(chainId: number, version = 14) {
  if (!isIndexToken(chainId, version)) throw new Error('Unsupported index token chain/version')
  const d = getChainDeployment(chainId), rh = chainId === 4663
  return {
    chainId, version, nativeSymbol: d.symbol, deployment: d,
    pump: (version === 14 ? d.contracts.pump14 : d.contracts.pump13) as Address,
    tokenAbi: (rh ? rhToken : bscToken) as Abi,
    pumpAbi: (rh ? rhPump : bscPump) as Abi,
    executor: (rh ? d.contracts.tradeRouter14 : d.contracts.tradeRouterMultiPump) as Address,
    liquidityExecutor: (rh ? d.contracts.tradeRouter14 : d.contracts.tradeRouter13) as Address,
    liquidityRouter: rh ? d.contracts.liquidityRouter14 : version === 13 ? d.contracts.liquidityRouter13 : undefined,
    nutboxRouter: (rh ? d.contracts.nutboxRouter14 : '0x72dc4F38A7E4159e97d826a6ab594748C6b68f17') as Address,
    hook: (rh ? d.contracts.tipTagSwapHook14 : version === 14 ? '0x2F0b231CAE7EdE4be0c52aA7eD5bAC62d1000Cc1' : '0xaC29EaEb5764A83f7Ed03240EA2aF54018210cc1') as Address,
    v2FeePips: rh ? 3000 : 2500,
    maxRoutes: 5,
  }
}
