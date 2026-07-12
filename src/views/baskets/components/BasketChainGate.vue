<script setup lang="ts">
/**
 * 非 RH 时引导切链；fee/router 未配置时提示
 */
import { computed } from 'vue'
import { useChainStore } from '@/stores/chain'
import { usePrivyStore } from '@/stores/privy'
import { useAccountStore, EthWalletState } from '@/stores/web3'
import { SPECTRUM_CHAIN_ID, hasSpectrumFeeWallet } from '@/config/spectrum'
import { getSpectrumDeployment } from '@/utils/spectrum/deployments'
import { getProvider } from '@/utils/wallets'
import { setupNetwork } from '@/utils/web3'

const chainStore = useChainStore()
const isOnRh = computed(() => chainStore.activeChainId === SPECTRUM_CHAIN_ID)
const hasFee = computed(() => hasSpectrumFeeWallet())
const hasRouter = computed(() => !!getSpectrumDeployment(SPECTRUM_CHAIN_ID)?.swapRouter)

const switchToRh = async () => {
  chainStore.setActiveChain(SPECTRUM_CHAIN_ID, { reload: false })
  const acc = useAccountStore()
  if (acc.ethConnectState === EthWalletState.Connected) {
    try {
      if (acc.getWalletType === 'privy') {
        await usePrivyStore().switchChain(SPECTRUM_CHAIN_ID)
      } else {
        const provider = getProvider()
        if (provider) await setupNetwork(provider)
      }
    } catch (e) {
      console.warn('[BasketChainGate] switch failed', e)
    }
  }
  window.location.reload()
}
</script>

<template>
  <div v-if="!isOnRh" class="mb-4 rounded-lg border border-orange-normal/30 bg-orange-normal/5 px-4 py-3 flex flex-col web:flex-row web:items-center gap-3 justify-between">
    <p class="text-sm text-content">{{ $t('baskets.switchChainHint') }}</p>
    <button
      type="button"
      class="shrink-0 px-4 h-9 rounded-lg bg-orange-normal text-white text-sm font-semibold hover:opacity-90"
      @click="switchToRh"
    >
      {{ $t('baskets.switchToRobinhood') }}
    </button>
  </div>
  <div
    v-else-if="!hasFee || !hasRouter"
    class="mb-4 rounded-lg border border-red-normal/30 bg-red-normal/5 px-4 py-3 text-sm text-content"
  >
    {{ $t('baskets.configMissing') }}
  </div>
</template>
