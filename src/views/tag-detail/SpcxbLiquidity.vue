<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useStateStore } from '@/stores/common'
import { useAccountStore, EthWalletState } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { getPoolTvl, invalidateClPositionsCache } from '@/apis/api'
import { resolveV4PoolId } from '@/utils/pcsV4Swap'
import {
  fetchPoolOverview,
  fetchUserClPositions,
  addClLiquidity,
  removeClLiquidity,
  ticksFromPreset,
  ticksFromPriceRange,
  tickToBnbPerToken,
  computePairAmount,
  formatLpFee,
} from '@/utils/pcsV4Liquidity'
import { formatAmount, formatPrice } from '@/utils/helper'
import { getUserTokenInfo } from '@/utils/pump'
import { handleErrorTip } from '@/utils/notify'
import { parseUnits, formatUnits, isAddress } from 'viem'
import type { ClPositionSummary, PriceRangePreset } from '@/types/liquidity'
import type { PoolKey } from '@pancakeswap/infinity-sdk'

type SubTab = 'add' | 'positions'

const comStore = useCommunityStore()
const stateStore = useStateStore()
const accStore = useAccountStore()
const modalStore = useModalStore()

const subTab = ref<SubTab>('add')
const loading = ref(false)
const submitting = ref(false)

const poolId = computed(() => resolveV4PoolId(comStore.currentSelectedCommunity?.pair))
const tick = computed(() => comStore.currentSelectedCommunity?.tick ?? '')

const priceBnb = ref(0)
const lpFee = ref(0)
const sqrtPriceX96 = ref(0n)
const currentTick = ref(0)
const tickSpacing = ref(1)
const poolKey = ref<PoolKey<'CL'> | null>(null)

const reserveBnb = ref(0n)
const reserveToken = ref(0n)

const rangePreset = ref<PriceRangePreset>('10')
const minPrice = ref('')
const maxPrice = ref('')
const tickLower = ref(0)
const tickUpper = ref(0)

const bnbAmount = ref('')
const tokenAmount = ref('')
const ethBalance = ref(0)
const tokenBalance = ref(0)
const slippage = ref('1')
const lastEdited = ref<'bnb' | 'token'>('bnb')

const positions = ref<ClPositionSummary[]>([])
const removePercent = ref(100)
const removingId = ref<bigint | null>(null)

const isWalletConnected = computed(
  () => accStore.ethConnectState === EthWalletState.Connected
    && isAddress(accStore.ethConnectAddress as `0x${string}`),
)

const isWalletConnecting = computed(
  () => accStore.ethConnectState === EthWalletState.Connecting,
)

/** 与 BuyAndSellView 一致：仅连接钱包，不要求平台登录 */
const promptConnectWallet = () => {
  modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
}

const slippageBps = computed(() => Math.round(parseFloat(slippage.value || '1') * 100))

const priceUsd = computed(() => priceBnb.value * stateStore.ethPrice)
/** 池内 BNB + 代币储备的 USD 总价值 */
const poolTvlUsd = computed(() => {
  if (!stateStore.ethPrice || !priceBnb.value) return 0
  const bnb = Number(formatUnits(reserveBnb.value, 18))
  const token = Number(formatUnits(reserveToken.value, 18))
  return bnb * stateStore.ethPrice + token * priceUsd.value
})
const minPriceNum = computed(() => parseFloat(minPrice.value) || 0)
const maxPriceNum = computed(() => parseFloat(maxPrice.value) || 0)

/** BNB/Token → 展示文案：0.325 ($0.32) */
const formatBnbPriceWithUsd = (bnbPerToken: number, precision = 6): string => {
  if (!bnbPerToken || bnbPerToken <= 0) return '-'
  const bnbStr = bnbPerToken.toPrecision(precision)
  if (!stateStore.ethPrice) return bnbStr
  return `${bnbStr} (${formatPrice(bnbPerToken * stateStore.ethPrice)})`
}

/** BNB/Token 价格字符串 → 带 USD */
const formatBnbPriceLabel = (priceStr: string) => {
  if (!priceStr || priceStr === '-') return '-'
  return formatBnbPriceWithUsd(parseFloat(priceStr))
}

/** 区间条：左低右高，标记当前价在 min~max 内的相对位置 */
const rangeBar = computed((): {
  ready: boolean
  currentPct: number
  inRange: boolean
  min?: number
  max?: number
  current?: number
} => {
  const min = minPriceNum.value
  const max = maxPriceNum.value
  const current = priceBnb.value
  if (!min || !max || max <= min || !current) {
    return { ready: false, currentPct: 50, inRange: true }
  }
  const rawPct = ((current - min) / (max - min)) * 100
  return {
    ready: true,
    currentPct: Math.min(100, Math.max(0, rawPct)),
    inRange: current >= min && current <= max,
    min,
    max,
    current,
  }
})

const formatPositionPriceRange = (pos: ClPositionSummary) => {
  const low = tickToBnbPerToken(pos.tickUpper)
  const high = tickToBnbPerToken(pos.tickLower)
  return `${formatBnbPriceWithUsd(low, 4)} — ${formatBnbPriceWithUsd(high, 4)}`
}

const syncTicksFromPreset = () => {
  if (!priceBnb.value || !tickSpacing.value) return
  if (rangePreset.value === 'manual') {
    if (minPriceNum.value > 0 && maxPriceNum.value > 0) {
      const t = ticksFromPriceRange(
        minPriceNum.value,
        maxPriceNum.value,
        tickSpacing.value,
        currentTick.value,
      )
      tickLower.value = t.tickLower
      tickUpper.value = t.tickUpper
    }
    return
  }
  const t = ticksFromPreset(rangePreset.value, priceBnb.value, tickSpacing.value, currentTick.value)
  tickLower.value = t.tickLower
  tickUpper.value = t.tickUpper
  // tickUpper → 低 BNB/Token（左）；tickLower → 高 BNB/Token（右）
  minPrice.value = tickToBnbPerToken(t.tickUpper).toPrecision(6)
  maxPrice.value = tickToBnbPerToken(t.tickLower).toPrecision(6)
}

watch([rangePreset, minPrice, maxPrice, priceBnb], syncTicksFromPreset)

const recalcPairAmount = (from: 'bnb' | 'token') => {
  if (!sqrtPriceX96.value || tickLower.value >= tickUpper.value) return
  try {
    if (from === 'bnb') {
      const a0 = parseUnits(bnbAmount.value || '0', 18)
      if (a0 <= 0n) { tokenAmount.value = ''; return }
      const a1 = computePairAmount(sqrtPriceX96.value, tickLower.value, tickUpper.value, 'bnb', a0)
      tokenAmount.value = a1 > 0n ? formatUnits(a1, 18) : ''
    } else {
      const a1 = parseUnits(tokenAmount.value || '0', 18)
      if (a1 <= 0n) { bnbAmount.value = ''; return }
      const a0 = computePairAmount(sqrtPriceX96.value, tickLower.value, tickUpper.value, 'token', a1)
      bnbAmount.value = a0 > 0n ? formatUnits(a0, 18) : ''
    }
  } catch {
    // 区间外可能只需单边
  }
}

watch(bnbAmount, () => { if (lastEdited.value === 'bnb') recalcPairAmount('bnb') })
watch(tokenAmount, () => { if (lastEdited.value === 'token') recalcPairAmount('token') })
watch([tickLower, tickUpper], () => recalcPairAmount(lastEdited.value))
watch(rangePreset, () => recalcPairAmount(lastEdited.value))

/** 拉取用户 BNB / 代币余额（与交易页一致） */
const loadUserBalances = async () => {
  const addr = accStore.ethConnectAddress
  const token = comStore.currentSelectedCommunity?.token
  if (!isWalletConnected.value || !token || !isAddress(addr as `0x${string}`)) {
    ethBalance.value = 0
    tokenBalance.value = 0
    return
  }
  try {
    const info = await getUserTokenInfo(token, addr as string)
    tokenBalance.value = Number(info.balance) / 1e18
    ethBalance.value = info.ethBalance ?? 0
  } catch (e) {
    console.warn('loadUserBalances failed', e)
  }
}

const loadOverview = async () => {
  const id = poolId.value
  if (!id) return
  loading.value = true
  try {
    const [overview, tvlRes] = await Promise.all([
      fetchPoolOverview(id),
      getPoolTvl(id),
    ])
    priceBnb.value = overview.priceBnb
    lpFee.value = overview.lpFee
    sqrtPriceX96.value = overview.sqrtPriceX96
    currentTick.value = overview.tick
    tickSpacing.value = overview.tickSpacing
    poolKey.value = overview.poolKey
    if (tvlRes?.c === 0 && tvlRes.d) {
      reserveBnb.value = BigInt(tvlRes.d.reserveToken0 || '0')
      reserveToken.value = BigInt(tvlRes.d.reserveToken1 || '0')
    }
    rangePreset.value = '10'
    syncTicksFromPreset()
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const loadPositions = async () => {
  const id = poolId.value
  const user = accStore.ethConnectAddress as `0x${string}`
  if (!id || !isWalletConnected.value) {
    positions.value = []
    return
  }
  loading.value = true
  try {
    positions.value = await fetchUserClPositions(user, id)
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  await loadOverview()
  await loadUserBalances()
  if (subTab.value === 'positions') await loadPositions()
}

const invalidateAndReloadPositions = async () => {
  const user = accStore.ethConnectAddress
  if (user && isAddress(user as `0x${string}`)) {
    try {
      await invalidateClPositionsCache(user as string)
    } catch (e) {
      console.warn('invalidate cl-positions cache failed', e)
    }
  }
  await loadOverview()
  await loadUserBalances()
  if (subTab.value === 'positions') await loadPositions()
}

const onAddLiquidity = async () => {
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    promptConnectWallet()
    return
  }
  if (!poolKey.value) return
  const a0 = parseUnits(bnbAmount.value || '0', 18)
  const a1 = parseUnits(tokenAmount.value || '0', 18)
  if (a0 <= 0n && a1 <= 0n) return

  submitting.value = true
  try {
    await addClLiquidity({
      poolKey: poolKey.value,
      tickLower: tickLower.value,
      tickUpper: tickUpper.value,
      amount0: a0,
      amount1: a1,
      slippageBps: slippageBps.value,
    })
    bnbAmount.value = ''
    tokenAmount.value = ''
    await invalidateAndReloadPositions()
  } catch (e) {
    handleErrorTip(e)
  } finally {
    submitting.value = false
  }
}

const onRemove = async (pos: ClPositionSummary) => {
  if (accStore.ethConnectState !== EthWalletState.Connected || !poolKey.value) {
    promptConnectWallet()
    return
  }
  removingId.value = pos.tokenId
  submitting.value = true
  try {
    await removeClLiquidity({
      tokenId: pos.tokenId,
      poolKey: poolKey.value,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity,
      percent: removePercent.value,
      sqrtPriceX96: sqrtPriceX96.value,
      tickCurrent: currentTick.value,
      slippageBps: slippageBps.value,
    })
    await invalidateAndReloadPositions()
  } catch (e) {
    handleErrorTip(e)
  } finally {
    submitting.value = false
    removingId.value = null
  }
}

watch(subTab, (t) => { if (t === 'positions') loadPositions() })
watch(isWalletConnected, () => {
  loadUserBalances()
  if (subTab.value === 'positions') loadPositions()
})
watch(() => accStore.ethConnectAddress, () => loadUserBalances())

onMounted(async () => {
  await refresh()
  await loadUserBalances()
})
</script>

<template>
  <div class="flex flex-col gap-2 pb-4">
    <div class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-2">
      <div class="text-h2 mb-1">{{ $t('liquidity.poolOverview') }}</div>
      <div v-if="loading && !priceBnb" class="text-h5 text-grey-93 py-4 text-center">{{ $t('loading') }}</div>
      <template v-else>
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93">{{ $t('postView.price') }}</span>
          <span class="text-h5 text-black-19 tabular-nums">{{ formatBnbPriceWithUsd(priceBnb) }}</span>
        </div>
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93">{{ $t('liquidity.bnbReserve') }}</span>
          <span class="text-h5 text-black-19">{{ formatAmount(Number(formatUnits(reserveBnb, 18))) }} BNB</span>
        </div>
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93">{{ $t('liquidity.tokenReserve', { tick }) }}</span>
          <span class="text-h5 text-black-19">{{ formatAmount(Number(formatUnits(reserveToken, 18))) }} {{ tick }}</span>
        </div>
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93">{{ $t('liquidity.poolMarketCap') }}</span>
          <span class="text-h5 text-black-19">{{ formatPrice(poolTvlUsd) }}</span>
        </div>
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93">{{ $t('liquidity.lpFee') }}</span>
          <span class="text-h5 text-black-19">{{ formatLpFee(lpFee) }}</span>
        </div>
      </template>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="text-h3 h-8 rounded-full px-3"
        :class="subTab === 'add' ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-black'"
        @click="subTab = 'add'"
      >{{ $t('liquidity.add') }}</button>
      <button
        class="text-h3 h-8 rounded-full px-3"
        :class="subTab === 'positions' ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-black'"
        @click="subTab = 'positions'"
      >{{ $t('liquidity.myPositions') }}</button>
    </div>

    <div v-if="subTab === 'add'" class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-4">
      <div class="text-h3 text-black">{{ $t('liquidity.selectRange') }}</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in (['full', '5', '10', 'manual'] as PriceRangePreset[])"
          :key="p"
          class="px-3 h-8 rounded-full text-h5 border"
          :class="rangePreset === p ? 'border-orange-normal bg-orange-normal/10 text-orange-normal' : 'border-grey-e6 text-grey-3f'"
          @click="rangePreset = p"
        >
          {{ p === 'full' ? $t('liquidity.fullRange') : p === 'manual' ? $t('liquidity.manual') : `±${p}%` }}
        </button>
      </div>
      <div v-if="rangeBar.ready" class="relative pt-9 pb-1">
        <!-- 当前价标记（上方） -->
        <div
          class="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none"
          :style="{ left: `${rangeBar.currentPct}%` }"
        >
          <span class="text-xs font-medium tabular-nums whitespace-nowrap text-center leading-tight" :class="rangeBar.inRange ? 'text-orange-normal' : 'text-grey-6f'">
            {{ formatBnbPriceWithUsd(rangeBar.current!, 4) }}
          </span>
          <span class="text-[10px] text-grey-93">{{ $t('liquidity.currentPrice') }}</span>
        </div>
        <!-- 轨道 + 选中区间 + 当前价竖线 -->
        <div class="relative h-2.5 bg-grey-e7 rounded-full mt-1">
          <div class="absolute inset-y-0 inset-x-0 bg-orange-normal/35 rounded-full border border-orange-normal/30" />
          <div
            class="absolute w-0.5 h-5 rounded-full -top-[7px] -translate-x-1/2 shadow-sm"
            :class="rangeBar.inRange ? 'bg-orange-normal' : 'bg-grey-6f'"
            :style="{ left: `${rangeBar.currentPct}%` }"
          />
          <div class="absolute w-1 h-3 bg-orange-normal/80 rounded-full -top-[3px] left-0 -translate-x-1/2" />
          <div class="absolute w-1 h-3 bg-orange-normal/80 rounded-full -top-[3px] right-0 translate-x-1/2" />
        </div>
        <!-- 区间下限 / 上限 -->
        <div class="flex justify-between mt-2 gap-2">
          <div class="flex flex-col items-start min-w-0 max-w-[48%]">
            <span class="text-[10px] text-grey-93">{{ $t('liquidity.minPrice') }}</span>
            <span class="text-xs tabular-nums text-grey-6f leading-tight">{{ formatBnbPriceWithUsd(rangeBar.min!, 4) }}</span>
          </div>
          <div class="flex flex-col items-end min-w-0 max-w-[48%]">
            <span class="text-[10px] text-grey-93">{{ $t('liquidity.maxPrice') }}</span>
            <span class="text-xs tabular-nums text-grey-6f leading-tight text-right">{{ formatBnbPriceWithUsd(rangeBar.max!, 4) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="h-2 bg-grey-e7 rounded-full my-1" />
      <div v-if="rangePreset === 'manual'" class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-h5 text-grey-93">{{ $t('liquidity.minPrice') }}</label>
          <input v-model="minPrice" type="text" class="border border-grey-c9 rounded-xl h-10 px-3 text-h5" />
          <span v-if="minPriceNum > 0" class="text-xs text-grey-93 tabular-nums">
            {{ formatBnbPriceWithUsd(minPriceNum, 4) }}
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-h5 text-grey-93">{{ $t('liquidity.maxPrice') }}</label>
          <input v-model="maxPrice" type="text" class="border border-grey-c9 rounded-xl h-10 px-3 text-h5" />
          <span v-if="maxPriceNum > 0" class="text-xs text-grey-93 tabular-nums">
            {{ formatBnbPriceWithUsd(maxPriceNum, 4) }}
          </span>
        </div>
      </div>
      <div v-else class="flex justify-between text-h5 text-grey-6f">
        <span>{{ $t('liquidity.minPrice') }}: {{ formatBnbPriceLabel(minPrice) }}</span>
        <span>{{ $t('liquidity.maxPrice') }}: {{ formatBnbPriceLabel(maxPrice) }}</span>
      </div>
      <div class="text-h3 text-black">{{ $t('liquidity.deposit') }}</div>
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <label class="text-h5 text-grey-93">BNB</label>
          <span v-if="isWalletConnected" class="text-sm text-grey-6f tabular-nums">
            {{ $t('balance') }}: {{ formatAmount(ethBalance) }}
          </span>
        </div>
        <input v-model="bnbAmount" type="text" class="border border-grey-c9 rounded-xl h-11 px-3 text-h4" placeholder="0.0" @focus="lastEdited = 'bnb'" />
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <label class="text-h5 text-grey-93">{{ tick }}</label>
          <span v-if="isWalletConnected" class="text-sm text-grey-6f tabular-nums">
            {{ $t('balance') }}: {{ formatAmount(tokenBalance) }}
          </span>
        </div>
        <input v-model="tokenAmount" type="text" class="border border-grey-c9 rounded-xl h-11 px-3 text-h4" placeholder="0.0" @focus="lastEdited = 'token'" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-h5 text-grey-93">{{ $t('liquidity.slippage') }}</span>
        <div class="flex gap-2 items-center">
          <button v-for="s in ['0.5', '1', '3']" :key="s" class="px-2 h-7 rounded-full text-xs border" :class="slippage === s ? 'border-orange-normal text-orange-normal' : 'border-grey-e6'" @click="slippage = s">{{ s }}%</button>
          <input v-model="slippage" class="w-14 h-7 border border-grey-c9 rounded-lg text-center text-xs" />%
        </div>
      </div>
      <button
        class="w-full h-11 rounded-full bg-gradient-primary text-white text-h3 disabled:opacity-50 flex items-center justify-center gap-2"
        :disabled="submitting || loading || isWalletConnecting"
        @click="onAddLiquidity"
      >
        <span v-if="!accStore.ethConnectAddress">{{ $t('connect') }}</span>
        <span v-else-if="submitting">{{ $t('loading') }}</span>
        <span v-else>{{ $t('liquidity.addBtn') }}</span>
        <i-ep-loading v-show="submitting || isWalletConnecting" class="animate-spin" />
      </button>
    </div>

    <div v-else class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-3">
      <div v-if="!isWalletConnected" class="flex flex-col items-center gap-3 py-6">
        <span class="text-h5 text-grey-93">{{ $t('liquidity.connectToView') }}</span>
        <button
          class="px-6 h-10 rounded-full bg-gradient-primary text-white text-h4 flex items-center gap-2 disabled:opacity-50"
          :disabled="isWalletConnecting"
          @click="promptConnectWallet"
        >
          {{ $t('connect') }}
          <i-ep-loading v-show="isWalletConnecting" class="animate-spin" />
        </button>
      </div>
      <div v-else-if="loading && positions.length === 0" class="text-h5 text-grey-93 text-center py-6">{{ $t('loading') }}</div>
      <div v-else-if="positions.length === 0" class="text-h5 text-grey-93 text-center py-6">{{ $t('liquidity.noPositions') }}</div>
      <div v-for="pos in positions" :key="pos.tokenId.toString()" class="border border-grey-e6 rounded-xl p-3 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <span class="text-h4 font-medium">#{{ pos.tokenId.toString() }}</span>
          <span class="text-xs px-2 py-0.5 rounded-full" :class="pos.inRange ? 'bg-green-51/20 text-green-34' : 'bg-grey-e7 text-grey-6f'">{{ pos.inRange ? $t('liquidity.inRange') : $t('liquidity.outOfRange') }}</span>
        </div>
        <div class="text-h5 text-grey-93">{{ $t('liquidity.priceRange') }}: {{ formatPositionPriceRange(pos) }} BNB/{{ tick }}</div>
        <div class="flex justify-between text-h5">
          <span>{{ formatAmount(Number(formatUnits(pos.amount0, 18))) }} BNB</span>
          <span>{{ formatAmount(Number(formatUnits(pos.amount1, 18))) }} {{ tick }}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <select v-model="removePercent" class="flex-1 h-9 border border-grey-c9 rounded-lg px-2 text-h5">
            <option :value="25">25%</option>
            <option :value="50">50%</option>
            <option :value="75">75%</option>
            <option :value="100">100%</option>
          </select>
          <button class="px-4 h-9 rounded-full bg-orange-normal text-white text-h5 disabled:opacity-50" :disabled="submitting && removingId === pos.tokenId" @click="onRemove(pos)">{{ $t('liquidity.remove') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
