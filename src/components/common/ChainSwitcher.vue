<script setup lang="ts">
/**
 * 产品链切换：BSC / Robinhood
 * 切链流程：同步钱包 → 持久化链 ID → 整页 reload
 */
import { computed } from 'vue'
import { useChainStore } from '@/stores/chain'
import { usePrivyStore } from '@/stores/privy'
import { PRODUCT_CHAIN_IDS, getChainDeployment, type ProductChainId } from '@/config/chains'
import { getProvider } from '@/utils/wallets'
import { setupNetwork } from '@/utils/web3'
import { EthWalletState, useAccountStore } from '@/stores/web3'

withDefaults(defineProps<{
  /** compact：仅显示当前链名按钮；list：纵向列表 */
  variant?: 'compact' | 'list'
}>(), {
  variant: 'compact',
})

const chainStore = useChainStore()
const activeChainId = computed(() => chainStore.activeChainId)
const activeLabel = computed(() => getChainDeployment(activeChainId.value).name)

const tabs = PRODUCT_CHAIN_IDS.map((id) => ({
  id,
  label: getChainDeployment(id).name,
  symbol: getChainDeployment(id).symbol,
}))

async function onSelectChain(chainId: ProductChainId) {
  if (chainId === chainStore.activeChainId) return

  // 先写入目标链（不 reload），便于 setupNetwork / Privy 读到正确 activeChainId
  chainStore.setActiveChain(chainId, { reload: false })

  const acc = useAccountStore()
  if (acc.ethConnectState === EthWalletState.Connected) {
    try {
      if (acc.getWalletType === 'privy') {
        await usePrivyStore().switchChain(chainId)
      } else {
        const provider = getProvider()
        if (provider) await setupNetwork(provider)
      }
    } catch (e) {
      console.warn('[ChainSwitcher] wallet switch failed', e)
    }
  }

  // 整页重载，所有数据按新链重新获取
  window.location.reload()
}
</script>

<template>
  <el-popover
    v-if="variant === 'compact'"
    popper-class="c-select-popper"
    trigger="click"
    width="160"
    :persistent="false"
    placement="bottom-end"
  >
    <template #reference>
      <button
        type="button"
        class="flex items-center gap-1.5 px-3 h-8 web:h-9 rounded-full bg-surface text-content hover:bg-surface-2 transition-colors text-xs web:text-sm"
        :aria-label="$t('chain.network')"
      >
        <span class="font-semibold">{{ activeLabel }}</span>
        <span class="text-grey-64">{{ getChainDeployment(activeChainId).symbol }}</span>
      </button>
    </template>
    <template #default>
      <div class="p-1 flex flex-col">
        <button
          v-for="tab of tabs"
          :key="tab.id"
          type="button"
          class="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-surface-2"
          :class="tab.id === activeChainId ? 'font-semibold text-orange-normal' : 'text-content'"
          @click="onSelectChain(tab.id)"
        >
          <span>{{ tab.label }}</span>
          <span class="text-grey-64 text-xs">{{ tab.symbol }}</span>
        </button>
      </div>
    </template>
  </el-popover>

  <div v-else class="flex flex-col gap-1 px-2 desk:px-4">
    <div class="hidden desk:block text-xs text-grey-64 px-2 mb-1">{{ $t('chain.network') }}</div>
    <button
      v-for="tab of tabs"
      :key="tab.id"
      type="button"
      class="flex items-center justify-center desk:justify-between px-0 desk:px-3 h-9 rounded-lg text-sm transition-colors"
      :class="tab.id === activeChainId ? 'bg-orange-normal text-white font-semibold' : 'text-content hover:bg-surface-2'"
      @click="onSelectChain(tab.id)"
    >
      <span class="hidden desk:inline">{{ tab.label }}</span>
      <span class="desk:hidden text-xs font-semibold">{{ tab.symbol }}</span>
      <span v-if="tab.id === activeChainId" class="hidden desk:inline text-xs opacity-90">✓</span>
    </button>
  </div>
</template>
