import { defineStore } from 'pinia'
import {
  DEFAULT_CHAIN_ID,
  getChainDeployment,
  isProductChain,
  type ChainDeployment,
  type ProductChainId,
} from '@/config/chains'

const STORAGE_KEY = 'tagai_active_chain_id'

const readStoredChainId = (): ProductChainId => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const id = raw ? Number(raw) : NaN
    if (isProductChain(id)) return id
  } catch {
    // ignore
  }
  return DEFAULT_CHAIN_ID
}

const persistChainId = (chainId: ProductChainId) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(chainId))
  } catch {
    // ignore
  }
}

/**
 * 产品当前链（BSC / Robinhood）。
 * 切链默认整页 reload，保证所有页面按新链重新拉数。
 */
export const useChainStore = defineStore('chain', {
  state: () => ({
    activeChainId: readStoredChainId() as ProductChainId,
  }),
  getters: {
    deployment(state): ChainDeployment {
      return getChainDeployment(state.activeChainId)
    },
    nativeCurrency(state) {
      return getChainDeployment(state.activeChainId).nativeCurrency
    },
    symbol(state): string {
      return getChainDeployment(state.activeChainId).symbol
    },
    browser(state): string {
      return getChainDeployment(state.activeChainId).browser
    },
  },
  actions: {
    /**
     * 切换产品链。
     * @param reload 默认 true：写入 localStorage 后整页刷新；false 仅改状态（供钱包同步等内部用）
     */
    setActiveChain(chainId: number, options?: { reload?: boolean }) {
      if (!isProductChain(chainId)) {
        throw new Error(`Unsupported product chain: ${chainId}`)
      }
      const shouldReload = options?.reload !== false
      if (this.activeChainId === chainId && shouldReload) return

      this.activeChainId = chainId
      persistChainId(chainId)

      if (shouldReload) {
        // 整页重载：各页面 onMounted / App 初始化会按新链拉数据
        window.location.reload()
      }
    },
  },
})
