<script setup lang="ts">
/**
 * 产品链切换：BSC / Robinhood
 * 切链流程：同步钱包 → 持久化链 ID → 导航到带链前缀的 URL
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChainStore } from '@/stores/chain'
import { usePrivyStore } from '@/stores/privy'
import { PRODUCT_CHAIN_IDS, getChainDeployment, getChainIdFromSlug, type ProductChainId } from '@/config/chains'
import { getProvider } from '@/utils/wallets'
import { setupNetwork } from '@/utils/web3'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import ChainLogo from '@/components/common/ChainLogo.vue'

withDefaults(defineProps<{
  /** compact：仅显示当前链名按钮；list：纵向列表 */
  variant?: 'compact' | 'list'
}>(), {
  variant: 'compact',
})

const chainStore = useChainStore()
const route = useRoute()
const router = useRouter()
const popoverRef = ref()
const activeChainId = computed(() => chainStore.activeChainId)
const activeChain = computed(() => getChainDeployment(activeChainId.value))

const tabs = PRODUCT_CHAIN_IDS.map((id) => ({
  id,
  key: getChainDeployment(id).key,
  label: getChainDeployment(id).name,
  fullLabel: getChainDeployment(id).key === 'bsc' ? 'BNB Smart Chain' : 'Robinhood Chain',
  symbol: getChainDeployment(id).symbol,
}))

async function onSelectChain(chainId: ProductChainId) {
  if (chainId === chainStore.activeChainId) {
    popoverRef.value?.hide()
    return
  }

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

  const parts = route.path.split('/').filter(Boolean)
  const nextSlug = getChainDeployment(chainId).key
  if (getChainIdFromSlug(parts[0])) parts[0] = nextSlug
  else parts.unshift(nextSlug)

  const query = { ...route.query }
  delete query.chainId
  // 通过完整页面导航重新初始化链相关数据，同时使复制后的 URL 自带链信息。
  window.location.assign(router.resolve({
    path: `/${parts.join('/')}`,
    query,
    hash: route.hash,
  }).href)
}
</script>

<template>
  <el-popover
    v-if="variant === 'compact'"
    ref="popoverRef"
    popper-class="c-select-popper chain-switcher-popper"
    trigger="click"
    width="264"
    :persistent="false"
    placement="bottom-end"
  >
    <template #reference>
      <button
        type="button"
        class="chain-trigger"
        :aria-label="$t('chain.network')"
      >
        <span class="chain-trigger__icon">
          <ChainLogo :chain="activeChain.key" />
          <i></i>
        </span>
        <span class="chain-trigger__copy">
          <small>{{ $t('chain.network') }}</small>
          <strong>{{ activeChain.name }}</strong>
        </span>
        <svg class="chain-trigger__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </template>
    <template #default>
      <div class="chain-menu">
        <div class="chain-menu__heading">
          <span>{{ $t('chain.network') }}</span>
          <small>BSC · RH</small>
        </div>
        <button
          v-for="tab of tabs"
          :key="tab.id"
          type="button"
          class="chain-option"
          :class="{ active: tab.id === activeChainId }"
          @click="onSelectChain(tab.id)"
        >
          <ChainLogo :chain="tab.key" />
          <span class="chain-option__copy">
            <strong>{{ tab.fullLabel }}</strong>
            <small>{{ tab.symbol }} · Mainnet</small>
          </span>
          <span class="chain-option__check">
            <svg v-if="tab.id === activeChainId" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="m5 9 2.6 2.6L13.2 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </template>
  </el-popover>

  <div v-else class="chain-list">
    <div class="chain-list__title">{{ $t('chain.network') }}</div>
    <button
      v-for="tab of tabs"
      :key="tab.id"
      type="button"
      class="chain-list__option"
      :class="{ active: tab.id === activeChainId }"
      @click="onSelectChain(tab.id)"
    >
      <ChainLogo :chain="tab.key" />
      <span class="chain-list__copy"><strong>{{ tab.label }}</strong><small>{{ tab.symbol }}</small></span>
      <span v-if="tab.id === activeChainId" class="chain-list__dot"></span>
    </button>
  </div>
</template>

<style scoped>
.chain-trigger { display: flex; height: 44px; min-width: 132px; align-items: center; gap: 9px; padding: 5px 10px 5px 6px; border: 1px solid var(--border-base); border-radius: 14px; background: var(--surface); color: var(--text-base); box-shadow: 0 5px 16px rgba(15,18,28,.05); transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, box-shadow 160ms ease; }
.chain-trigger:hover { transform: translateY(-1px); border-color: rgba(244,125,37,.42); background: var(--surface-2); box-shadow: 0 8px 20px rgba(15,18,28,.08); }
.chain-trigger__icon { position: relative; display: inline-flex; }
.chain-trigger__icon :deep(.chain-logo) { width: 32px; height: 32px; flex-basis: 32px; }
.chain-trigger__icon i { position: absolute; right: -1px; bottom: -1px; width: 9px; height: 9px; border: 2px solid var(--surface); border-radius: 50%; background: #35c96f; }
.chain-trigger__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; line-height: 1.05; }
.chain-trigger__copy small { margin-bottom: 4px; color: var(--text-muted); font-size: 8px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; }
.chain-trigger__copy strong { max-width: 68px; overflow: hidden; font-size: 12px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.chain-trigger__chevron { width: 16px; height: 16px; flex: 0 0 16px; color: var(--text-muted); transition: transform 160ms ease; }

:global(.chain-switcher-popper.el-popper) { padding: 7px !important; border: 1px solid var(--border-base) !important; border-radius: 18px !important; background: var(--surface) !important; box-shadow: 0 18px 50px rgba(10,12,20,.16) !important; }
:global(.chain-switcher-popper.el-popper .el-popper__arrow::before) { border-color: var(--border-base) !important; background: var(--surface) !important; }
.chain-menu { display: flex; flex-direction: column; gap: 5px; }
.chain-menu__heading { display: flex; align-items: center; justify-content: space-between; padding: 7px 9px 8px; color: var(--text-base); }
.chain-menu__heading span { font-size: 12px; font-weight: 750; }
.chain-menu__heading small { color: var(--text-muted); font-size: 9px; }
.chain-option { display: flex; width: 100%; align-items: center; gap: 11px; padding: 10px; border: 1px solid transparent; border-radius: 13px; color: var(--text-base); text-align: left; transition: background 150ms ease, border-color 150ms ease; }
.chain-option:hover { background: var(--surface-2); }
.chain-option.active { border-color: rgba(244,125,37,.22); background: linear-gradient(100deg, rgba(244,125,37,.11), rgba(244,125,37,.035)); }
.chain-option :deep(.chain-logo) { width: 36px; height: 36px; flex-basis: 36px; border-radius: 11px; }
.chain-option__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
.chain-option__copy strong { font-size: 12px; font-weight: 720; }
.chain-option__copy small { color: var(--text-muted); font-size: 9px; }
.chain-option__check { display: inline-flex; width: 21px; height: 21px; align-items: center; justify-content: center; border: 1px solid var(--border-base); border-radius: 50%; color: #f47d25; }
.chain-option.active .chain-option__check { border-color: rgba(244,125,37,.32); background: rgba(244,125,37,.12); }
.chain-option__check svg { width: 16px; height: 16px; }

.chain-list { display: flex; flex-direction: column; gap: 5px; padding: 0 8px; }
.chain-list__title { display: none; padding: 0 8px 4px; color: var(--text-muted); font-size: 10px; }
.chain-list__option { position: relative; display: flex; height: 42px; align-items: center; justify-content: center; gap: 9px; border-radius: 12px; color: var(--text-base); transition: background 150ms ease; }
.chain-list__option:hover, .chain-list__option.active { background: var(--surface-2); }
.chain-list__option :deep(.chain-logo) { width: 28px; height: 28px; flex-basis: 28px; border-radius: 9px; }
.chain-list__copy { display: none; min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; }
.chain-list__copy strong { font-size: 11px; }
.chain-list__copy small { color: var(--text-muted); font-size: 9px; }
.chain-list__dot { position: absolute; right: 9px; width: 6px; height: 6px; border-radius: 50%; background: #f47d25; }

:global(html.dark) .chain-trigger,
:global(html.dark) .chain-menu { background: #16181d !important; }
:global(html.dark) .chain-trigger { border-color: #262a31; color: #e6e8ec; }
:global(html.dark) .chain-trigger:hover { background: #1e2127 !important; }
:global(html.dark .chain-switcher-popper.el-popper) { border-color: #262a31 !important; background: #16181d !important; }
:global(html.dark .chain-switcher-popper.el-popper .el-popper__arrow::before) { border-color: #262a31 !important; background: #16181d !important; }

@media (min-width: 1200px) {
  .chain-list { padding: 0 16px; }
  .chain-list__title { display: block; }
  .chain-list__option { justify-content: flex-start; padding: 0 8px; }
  .chain-list__copy { display: flex; }
}

@media (max-width: 767px) {
  .chain-trigger { width: 43px; min-width: 43px; height: 40px; padding: 4px; justify-content: center; border-radius: 13px; }
  .chain-trigger__copy, .chain-trigger__chevron { display: none; }
  .chain-trigger__icon :deep(.chain-logo) { width: 30px; height: 30px; flex-basis: 30px; }
}
</style>
