import { isAddress } from 'viem'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { getIPShareSupply, ipshareCreated } from '@/utils/ipshare'

/**
 * 登录用户须已在 IPShareContract3 创建 IPShare（与 Blink 前置检测一致）。
 * 未满足时弹出对应引导弹窗并返回 false。
 */
export async function ensureUserIPShare(): Promise<boolean> {
  const accStore = useAccountStore()
  const modalStore = useModalStore()
  const account = accStore.getAccountInfo

  if (!account?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return false
  }

  const ethAddr = account.ethAddr ?? ''
  if (!isAddress(ethAddr)) {
    modalStore.setModalVisible(true, GlobalModalType.BondEth)
    return false
  }

  if (!accStore.ipshare?.ethAddr) {
    const created = await ipshareCreated(ethAddr)
    if (created) {
      const supply = await getIPShareSupply(ethAddr) as number
      accStore.ipshare = {
        ethAddr,
        shareSupply: typeof supply === 'number' && supply >= 10 ? supply : 10,
        created: true,
      }
    } else {
      const supply = await getIPShareSupply(ethAddr) as number
      if (typeof supply === 'number' && supply >= 10) {
        accStore.ipshare = { ethAddr, shareSupply: supply, created: true }
      }
    }
  }

  if (!isAddress(accStore.ipshare?.ethAddr ?? '')) {
    modalStore.setModalVisible(true, GlobalModalType.CreateIPShare)
    return false
  }

  return true
}
