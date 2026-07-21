<script setup lang="ts">
import { useCommunityStore } from "@/stores/community";
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { formatAddress, formatAmount, formatAmountTrunc, formatPrice, sleep, formatDate } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { type TokenHoldingList } from "@/types";
import { getHolderList, getHolderListOfImportToken } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { TotalSupply, SocialSupply, ListSupply, PUMP9_VERSION, TipTagSwapHook9, PCSCLPoolManager, PCSVault } from '@/config'
import UserAvatar from "@/components/common/UserAvatar.vue";
import emptyAvatar from "@/assets/icons/icon-default-avatar.svg";
import { getBlockNumber } from "@/utils/wallets";
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, PumpContract5, PumpContract6, PumpContract7 } from "@/config";
import { getV9DailyRewards, getV10DistributionInfo, type V10DistributionInfo, injectTokens } from "@/utils/pump";
import { readContract } from "@/utils/contract";
import { useAccountStore } from "@/stores/web3";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { EthWalletState } from "@/stores/web3";
import { parseUnits, formatUnits, isAddress, zeroAddress } from "viem";
import VueApexCharts from "vue3-apexcharts";
import type { ApexOptions } from "apexcharts";
import { useI18n } from "vue-i18n";
import { useTools } from "@/composables/useTools";
import { useChainStore } from "@/stores/chain";
import { useTheme } from "@/composables/useTheme";

const ApexCharts = VueApexCharts as any;
const { t } = useI18n();
const { onCopy } = useTools();
const comStore = useCommunityStore()
const chainStore = useChainStore()
const { isDark } = useTheme()
const modalStore = useModalStore()
const accountStore = useAccountStore()
const isWalletConnected = computed(() => accountStore.ethConnectState === EthWalletState.Connected && isAddress(accountStore.ethConnectAddress as `0x${string}`))

const holdingList = ref<TokenHoldingList[]>([])
const showDistributionModal = ref(false)

/** v9：按天聚合的分发量（过去 7 天含今天 + 明日） */
const v9HourlyAmounts = ref<number[]>([])
const v9HourlyLabels = ref<string[]>([])
const v9TodayChartIndex = ref(6)
const v9HourlyLoaded = ref(false)
const v9HourlyLoading = ref(false)
/** 今天的每小时分发量（24 个值，用于精确拆分已发生/预测） */
const v9TodayHourlyAmounts = ref<number[]>([])

/** v10：链上分发信息（根据 calculator 类型不同，数据结构不同） */
const v10Distribution = ref<V10DistributionInfo | null>(null)
const v10Loading = ref(false)
const v10Loaded = ref(false)

const isV9 = computed(() => comStore.currentSelectedCommunity?.version === PUMP9_VERSION)
const isPumpV9OrV10 = computed(() => {
  const version = Number(comStore.currentSelectedCommunity?.version)
  return version === PUMP9_VERSION || version === 10
})
const marketCapText = computed(() => {
  const nativeMarketCap = Number(comStore.currentSelectedCommunity?.marketCap ?? 0)
  const nativeUsdPrice = Number(useStateStore().ethPrice ?? 0)
  if (!Number.isFinite(nativeMarketCap) || nativeMarketCap <= 0) return formatPrice(0)
  if (Number.isFinite(nativeUsdPrice) && nativeUsdPrice > 0) {
    return formatPrice(Math.round(nativeMarketCap * nativeUsdPrice))
  }
  return `${formatAmount(nativeMarketCap)} ${chainStore.nativeCurrency.symbol}`
})

/** v9 或 v10 + HourlyTickCalculator → 柱状图展示 */
const isHourly = computed(() => {
  if (isV9.value) return true
  if (comStore.currentSelectedCommunity?.version === 10 && v10Distribution.value?.calculatorType === 'hourly') return true
  return false
})

/** v10 + LinearCalculator → 区块时间轴 */
const isV10Block = computed(() =>
  comStore.currentSelectedCommunity?.version === 10 && v10Distribution.value?.calculatorType === 'block'
)

/** 展示 Nutbox 社区地址的版本（v9 从链上读取，v10 从 community 数据获取） */
const showNutboxInfo = computed(() => isV9.value || comStore.currentSelectedCommunity?.version === 10)
const displayNutboxCommunityAddr = computed(() => {
  if (isV9.value) return v9NutboxCommunityAddr.value
  return comStore.currentSelectedCommunity?.communityAddress || ''
})

/** Inject Rewards 弹窗 */
const showInjectModal = ref(false)
const injectAmount = ref('')
const injectLoading = ref(false)
const injectTokenBalance = ref(0n)

async function openInjectModal() {
  const community = comStore.currentSelectedCommunity
  if (!community?.token) return
  showInjectModal.value = true
  injectAmount.value = ''
  if (!isWalletConnected.value) {
    injectTokenBalance.value = 0n
    return
  }
  try {
    const userAddr = accountStore.ethConnectAddress as `0x${string}`
    const balance = await readContract('ERC20', 'balanceOf', [userAddr], community.token as `0x${string}`) as bigint
    injectTokenBalance.value = balance
  } catch (e) {
    console.error('get token balance failed', e)
    injectTokenBalance.value = 0n
  }
}

async function onInjectConfirm() {
  const community = comStore.currentSelectedCommunity
  if (!community?.token || !community?.communityAddress) return
  const amountStr = injectAmount.value.trim()
  if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) return

  injectLoading.value = true
  try {
    const amount = parseUnits(amountStr, 18)
    await injectTokens(
      community.communityAddress as `0x${string}`,
      community.token as `0x${string}`,
      amount
    )
    showInjectModal.value = false
    // 刷新每日奖励数据
    if (isV9.value) {
      await loadV9HourlyRewards()
    } else if (community.version === 10) {
      await loadV10Distribution()
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    injectLoading.value = false
  }
}

/** v9 holder 列表特殊地址：Hook / Nutbox Community / PCS V4 */
const v9HookAddr = ref('')
const v9NutboxCommunityAddr = ref('')
const v9SocialPoolAddr = ref('')
const v9PcsV4Addrs = ref<string[]>([])

const normalizeAddr = (addr?: string | null) => addr?.toLowerCase() ?? ''

const isSameAddr = (a?: string | null, b?: string | null) =>
  normalizeAddr(a) !== '' && normalizeAddr(a) === normalizeAddr(b)

const isPcsV4Holder = (holderAddr?: string) =>
  v9PcsV4Addrs.value.some(addr => isSameAddr(holderAddr, addr))

const legacyPumpAddrs = [
  PumpContract1, PumpContract2, PumpContract3, PumpContract4,
  PumpContract5, PumpContract6, PumpContract7,
]

/** 打开当前产品链浏览器上的合约地址（RH→Blockscout，BSC→BscScan） */
function openExplorerAddress(addr: string) {
  if (!addr) return
  const base = chainStore.browser.replace(/\/$/, '')
  window.open(`${base}/address/${addr}`, '_blank')
}

async function loadV9HolderAddresses() {
  if (!isV9.value) return
  const token = comStore.currentSelectedCommunity?.token
  if (!token || !isAddress(token)) return

  try {
    const tokenAddr = token as `0x${string}`
    const [community, socialPool] = await Promise.all([
      readContract('Token9', 'nutboxCommunity', [], tokenAddr) as Promise<string>,
      readContract('Token9', 'nutboxSocialPool', [], tokenAddr) as Promise<string>,
    ])
    v9NutboxCommunityAddr.value = community && community !== zeroAddress ? community : ''
    v9SocialPoolAddr.value = socialPool && socialPool !== zeroAddress ? socialPool : ''

    let hook = normalizeAddr(TipTagSwapHook9)
    const pcsAddrs = new Set<string>([
      normalizeAddr(PCSCLPoolManager),
      normalizeAddr(PCSVault),
    ])

    const pair = comStore.currentSelectedCommunity?.pair
    if (pair?.startsWith('{')) {
      try {
        const poolKey = JSON.parse(pair) as { hooks?: string; poolManager?: string }
        if (poolKey.hooks) hook = normalizeAddr(poolKey.hooks)
        if (poolKey.poolManager) pcsAddrs.add(normalizeAddr(poolKey.poolManager))
      } catch (e) {
        console.error('parse v9 poolKey failed', e)
      }
    }

    v9HookAddr.value = hook
    v9PcsV4Addrs.value = [...pcsAddrs].filter(Boolean)
  } catch (e) {
    console.error('loadV9HolderAddresses failed', e)
    v9HookAddr.value = normalizeAddr(TipTagSwapHook9)
    v9NutboxCommunityAddr.value = ''
    v9SocialPoolAddr.value = ''
    v9PcsV4Addrs.value = [normalizeAddr(PCSCLPoolManager), normalizeAddr(PCSVault)].filter(Boolean)
  }
}

/** 加载 v10 导入代币的链上分发信息 */
async function loadV10Distribution() {
  const community = comStore.currentSelectedCommunity
  if (!community || community.version !== 10 || !community.communityAddress || !community.socialPoolAddress) return
  v10Loading.value = true
  try {
    const info = await getV10DistributionInfo(community.communityAddress, community.socialPoolAddress)
    v10Distribution.value = info
    // 如果是 hourly 类型，同时初始化柱状图数据
    if (info?.calculatorType === 'hourly' && info.hourly) {
      v9TodayChartIndex.value = info.hourly.todayIndex
      v9HourlyAmounts.value = info.hourly.dailyRewards.map(r => Number(r) / 1e18)
      v9HourlyLabels.value = info.hourly.dayStarts.map((ts, i) => formatV9ChartDayLabel(ts, i, info.hourly!.todayIndex))
      // 提取今天的 24 小时分发量
      const todayStart = info.hourly.todayIndex * 24
      v9TodayHourlyAmounts.value = info.hourly.hourlyRewards.slice(todayStart, todayStart + 24).map(r => Number(r) / 1e18)
      v9HourlyLoaded.value = true
    }
    v10Loaded.value = true
  } catch (e) {
    console.error('loadV10Distribution failed', e)
    v10Distribution.value = null
    v10Loaded.value = false
  } finally {
    v10Loading.value = false
  }
}

/** 柱状图：已发生（黄）/ 预测（紫） */
const CHART_COLOR_ACTUAL = '#FF8F40'
const CHART_COLOR_FORECAST = '#9B83FA'

/** 今天已过去的时间占比（0~1，本地时区） */
function getTodayElapsedRatio() {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const elapsedMs = now.getTime() - dayStart.getTime()
  return Math.min(1, Math.max(0, elapsedMs / (24 * 3600 * 1000)))
}

const hourlyBarOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'bar',
    height: 220,
    stacked: true,
    toolbar: { show: false },
    fontFamily: 'inherit',
    background: 'transparent',
    foreColor: isDark.value ? '#B6BCC7' : '#3F3F3F',
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  plotOptions: {
    bar: {
      borderRadius: 4,
      columnWidth: '70%',
      borderRadiusApplication: 'end',
      borderRadiusWhenStacked: 'last',
    },
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: v9HourlyLabels.value,
    axisBorder: { color: isDark.value ? '#363B44' : '#D1D5DB' },
    axisTicks: { color: isDark.value ? '#363B44' : '#D1D5DB' },
    labels: {
      rotate: 0,
      style: { fontSize: '11px', colors: isDark.value ? '#B6BCC7' : '#3F3F3F' },
    },
  },
  yaxis: {
    labels: {
      formatter: (val: number) => formatAmountTrunc(val),
      style: { colors: isDark.value ? '#B6BCC7' : '#3F3F3F' },
    },
  },
  tooltip: {
    theme: isDark.value ? 'dark' : 'light',
    y: {
      formatter: (val: number) => `${formatAmountTrunc(val)} ${comStore.currentSelectedCommunity?.tick ?? ''}`,
    },
  },
  colors: [CHART_COLOR_ACTUAL, CHART_COLOR_FORECAST],
  legend: {
    show: true,
    position: 'top',
    horizontalAlign: 'right',
    fontSize: '11px',
    markers: { size: 6, radius: 2 },
  },
  grid: {
    strokeDashArray: 4,
    borderColor: isDark.value ? '#363B44' : '#D9DDE5',
  },
}))

const hourlyBarSeries = computed(() => {
  const amounts = v9HourlyAmounts.value
  const todayIdx = v9TodayChartIndex.value
  const todayHourly = v9TodayHourlyAmounts.value
  const actualData: number[] = []
  const forecastData: number[] = []

  amounts.forEach((amount, i) => {
    if (i < todayIdx) {
      // 历史：全部已发生
      actualData.push(amount)
      forecastData.push(0)
    } else if (i === todayIdx && todayHourly.length === 24) {
      // 今天：按小时精确拆分，当前小时整小时算预测
      const currentHour = new Date().getHours()
      let actual = 0
      let forecast = 0
      for (let h = 0; h < 24; h++) {
        if (h < currentHour) {
          actual += todayHourly[h]
        } else {
          forecast += todayHourly[h]
        }
      }
      actualData.push(actual)
      forecastData.push(forecast)
    } else if (i === todayIdx) {
      // 今天但无小时数据时回退到时间比例
      const elapsedRatio = getTodayElapsedRatio()
      actualData.push(amount * elapsedRatio)
      forecastData.push(amount * (1 - elapsedRatio))
    } else {
      // 明天及以后：全部预测
      actualData.push(0)
      forecastData.push(amount)
    }
  })

  return [
    { name: t('postView.chartActual'), data: actualData },
    { name: t('postView.chartForecast'), data: forecastData },
  ]
})

function formatV9ChartDayLabel(dayStartSec: number, dayIndex: number, todayIndex: number) {
  const dateStr = new Date(dayStartSec * 1000).toLocaleDateString([], { month: 'numeric', day: 'numeric' })
  if (dayIndex === todayIndex) return `${dateStr} (${t('postView.chartToday')})`
  if (dayIndex === todayIndex + 1) return `${dateStr} (${t('postView.chartTomorrow')})`
  return dateStr
}

async function loadV9HourlyRewards() {
  const token = comStore.currentSelectedCommunity?.token
  if (!token || !isAddress(token) || !isV9.value) return
  v9HourlyLoading.value = true
  try {
    const { dailyRewards, dayStarts, todayIndex, hourlyRewards } = await getV9DailyRewards(token as `0x${string}`)
    v9TodayChartIndex.value = todayIndex
    v9HourlyAmounts.value = dailyRewards.map(r => Number(r) / 1e18)
    v9HourlyLabels.value = dayStarts.map((ts, i) => formatV9ChartDayLabel(ts, i, todayIndex))
    // 提取今天的 24 小时分发量
    const todayStart = todayIndex * 24
    v9TodayHourlyAmounts.value = hourlyRewards.slice(todayStart, todayStart + 24).map(r => Number(r) / 1e18)
    v9HourlyLoaded.value = true
  } catch (e) {
    console.error('loadV9HourlyRewards failed', e)
    v9HourlyAmounts.value = []
    v9HourlyLabels.value = []
    v9TodayHourlyAmounts.value = []
    v9HourlyLoaded.value = false
  } finally {
    v9HourlyLoading.value = false
  }
}

/** 分配弹窗内可滚动容器，用于打开时滚动到当前阶段 */
const distributionScrollRef = ref<HTMLElement | null>(null)
/** 各分发阶段对应的 DOM 元素，用于滚动定位 */
const phaseRefs = ref<(HTMLElement | null)[]>([])

const setPhaseRef = (el: unknown, index: number) => {
  if (el) {
    const arr = phaseRefs.value
    if (index >= arr.length) {
      arr.length = index + 1
    }
    arr[index] = el as HTMLElement
  }
}

const chartOptions = ref({
  chart: {
    height: 200,
    type: 'line',
    toolbar: {
      show: false
    },
  },
  stroke: {
    width: 5,
    curve: 'smooth'
  },
  xaxis: {
    type: 'datetime',
    categories: ['1/11/2000', '2/11/2000', '3/11/2000', '4/11/2000', '5/11/2000', '6/11/2000', '7/11/2000', '8/11/2000', '9/11/2000', '10/11/2000', '11/11/2000', '12/11/2000', '1/11/2001', '2/11/2001', '3/11/2001','4/11/2001' ,'5/11/2001' ,'6/11/2001'],
    tickAmount: 10,
    labels: {
      show: false
    }
  },
  yaxis: {
    labels: {
      show: false
    }
  },
  title: {
    show: false
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      type: 'horizontal',
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 50, 100],
      colorStops: [
        [
          { offset: 0, color: '#FF8F40', opacity: 1},
          { offset: 35, color: '#F963B5', opacity: 1},
          { offset: 65, color: '#4040F7', opacity: 1}
        ]
      ]
    },
  }
})
const series = ref([{
  name: 'Price',
  data: [4, 3, 10, 9, 29, 19, 22, 9, 12, 7, 19, 5, 13, 9, 17, 2, 7, 5]
}])

const chartTabs = ['12H', '24H', '1W', '1Y', 'All']
const activeTab = ref('12H')

const progressData = ref([
  {amount: 20, stopHeight: 20, background: '#FA8383'},
  {amount: 20, stopHeight: 40, background: '#FACA83'},
  {amount: 20, stopHeight: 60, background: '#B0FA83'},
  {amount: 20, stopHeight: 80, background: '#83DDFA'},
  {amount: 20, stopHeight: 100, background: '#9B83FA'},
])

// reward per day
// -1 means no distribution of this community(not list)
// 0 means no reward of current day
const rewardPerDay = computed(() => {
  if (isHourly.value) {
    if (!v9HourlyLoaded.value) return -1
    if (v9HourlyAmounts.value.length === 0) return 0
    // 过去 7 天（含今天），排除分发为 0 的天后取平均
    const pastSevenDays = v9HourlyAmounts.value.slice(0, v9TodayChartIndex.value + 1)
    const activeDays = pastSevenDays.filter(amount => amount > 0)
    if (activeDays.length === 0) return 0
    return activeDays.reduce((sum, amount) => sum + amount, 0) / activeDays.length
  }
  // v10：从链上读取的分发阶段
  if (v10Distribution.value?.phases) {
    const currentTime = Math.ceil(Date.now() / 1000)
    const currentBlock = BigInt(Math.floor(Date.now() / 1000)) // placeholder, actual block not needed for rate
    for (const phase of v10Distribution.value.phases) {
      if (v10Distribution.value.calculatorType === 'timestamp') {
        if (phase.startCursor <= BigInt(currentTime) && phase.stopCursor >= BigInt(currentTime)) {
          return Math.ceil(Number(phase.amount) * 86400)
        }
      } else if (v10Distribution.value.calculatorType === 'block') {
        // BSC ~3s per block, ~28800 blocks per day
        const blocksPerDay = 28800
        const currentBlockNum = 0n // not needed for rate calculation
        return Math.ceil(Number(phase.amount) * blocksPerDay)
      }
    }
    return 0
  }
  if (!comStore?.currentSelectedCommunity?.distribution) {
    return -1;
  }
  try {
    const distribution = JSON.parse(comStore.currentSelectedCommunity.distribution);
    const currentTime = Math.ceil(Date.now() / 1000);
    if (currentTime === 0) {
      return 0;
    }
    if (distribution.length === 0) {
      return -1;
    }
    let currentRewardPerSecond = 0;
    for(let dis of distribution){
      if (dis.start <= currentTime&& dis.end >= currentTime) {
        currentRewardPerSecond = dis.amount;
        break;
      }
    }
    return Math.ceil(currentRewardPerSecond * 86400)
  } catch (error) {
    return -1;
  }
})

/** v10 非 hourly：从链上分发阶段转换为 timeline 展示格式 */
const v10TimelineDistribution = computed(() => {
  const info = v10Distribution.value
  if (!info?.phases) return []
  if (info.calculatorType === 'timestamp') {
    return info.phases.map(p => ({
      start: Number(p.startCursor),
      end: Number(p.stopCursor),
      amount: Number(p.amount) / 1e18  // per second, in token units
    }))
  }
  if (info.calculatorType === 'block') {
    return info.phases.map(p => ({
      start: Number(p.startCursor),
      end: Number(p.stopCursor),
      amount: Number(p.amount) / 1e18  // per block, in token units
    }))
  }
  return []
})

/** 统一的分发时间线数据（v10 非 hourly 从链上读取，其他从 community.distribution 解析） */
const timelineDistribution = computed(() => {
  if (v10TimelineDistribution.value.length > 0) return v10TimelineDistribution.value
  if (comStore?.currentSelectedCommunity?.distribution) {
    try {
      const distribution = JSON.parse(comStore.currentSelectedCommunity.distribution)
      return distribution.reverse()
    } catch { return [] }
  }
  return []
})

async function openDistributionModal() {
  if (isHourly.value && isV9.value) {
    await loadV9HourlyRewards()
  }
  if (comStore.currentSelectedCommunity?.version === 10 && !v10Loaded.value) {
    await loadV10Distribution()
  }
  showDistributionModal.value = true
}

const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);

async function onRefresh() {
  if (loading.value) return;
  refreshing.value = true;
  finished.value = false;
  try{
    let list: any;
    if (comStore.currentSelectedCommunity?.isImport) {
      list = await getHolderListOfImportToken(comStore.currentSelectedCommunity!.token)
    } else {
      list = await getHolderList(comStore.currentSelectedCommunity!.token)
    }
    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          ...h,
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = list as TokenHoldingList[];
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  if (refreshing.value || finished.value || holdingList.value.length == 0) return;
  loading.value = true;
  try{
    let list: any;
    if (comStore.currentSelectedCommunity?.isImport) {
      list = await getHolderListOfImportToken(comStore.currentSelectedCommunity!.token, Math.floor((holdingList.value.length - 1) / 30) + 1);
    } else {
      list = await getHolderList(comStore.currentSelectedCommunity!.token, Math.floor((holdingList.value.length - 1) / 30) + 1);
    }
    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          ...h,
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = holdingList.value.concat(list as TokenHoldingList[]);
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

const onUserAvatar = () => {

}
function replaceEmptyImg(e: any) {
    e.target.src = emptyAvatar;
}

// 判断是否为当前进行中的周期
function isCurrentPeriod(start: number, end: number) {
  // v10 block：用区块号近似判断（BSC ~3s/block）
  if (isV10Block.value) {
    const approxCurrentBlock = Math.floor(Date.now() / 1000 / 3)
    return start <= approxCurrentBlock && end >= approxCurrentBlock
  }
  const currentTime = Math.ceil(Date.now() / 1000);
  return start <= currentTime && end >= currentTime;
}

/** 将弹窗内容滚动到当前进行中的分发阶段（可重试，应对 dialog 延迟挂载） */
function scrollToCurrentPhase(retryCount = 0) {
  const list = timelineDistribution.value
  if (!list?.length) return
  const currentIndex = list.findIndex((item: { start: number; end: number }) =>
    isCurrentPeriod(item.start, item.end)
  )
  if (currentIndex < 0) return
  const container = distributionScrollRef.value
  const targetEl = phaseRefs.value[currentIndex]
  if (!container || !targetEl) {
    if (retryCount < 5) {
      setTimeout(() => scrollToCurrentPhase(retryCount + 1), 50)
    }
    return
  }
  const containerRect = container.getBoundingClientRect()
  const targetRect = targetEl.getBoundingClientRect()
  const offsetTop = targetRect.top - containerRect.top + container.scrollTop
  container.scrollTop = Math.max(0, offsetTop - 24) // 留 24px 上边距
}

/** 弹窗完全打开后执行滚动（@opened 时 ref 已就绪） */
function onDistributionModalOpened() {
  nextTick(() => scrollToCurrentPhase())
}

// 弹窗关闭时清空阶段 ref，避免残留
watch(showDistributionModal, (visible) => {
  if (!visible) phaseRefs.value = []
})

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.3)
  }
  if (isV9.value) {
    await Promise.all([loadV9HourlyRewards(), loadV9HolderAddresses()])
  } else if (comStore.currentSelectedCommunity?.version === 10) {
    await loadV10Distribution()
  }
  onRefresh()
})

watch(() => comStore.currentSelectedCommunity?.token, async (token) => {
  if (token && isV9.value) {
    v9HourlyLoaded.value = false
    await Promise.all([loadV9HourlyRewards(), loadV9HolderAddresses()])
  } else if (token && comStore.currentSelectedCommunity?.version === 10) {
    v10Loaded.value = false
    v10Distribution.value = null
    v9HourlyLoaded.value = false
    v9HourlyAmounts.value = []
    await loadV10Distribution()
  }
})

watch(() => comStore.currentSelectedCommunity?.pair, () => {
  if (isV9.value) loadV9HolderAddresses()
})
</script>

<template>
  <div class="" v-if="comStore.currentSelectedCommunity?.tick">
    <!-- <div class="bg-white p-3 rounded-2xl">
      <div class="flex justify-between items-center">
        <div class="flex items-end gap-1">
          <span class="text-lg font-bold leading-5">LATC</span>
          <span class="text-xs text-grey-6f leading-4">Chart</span>
        </div>
        <div class="text-red-e6 text-base">0.2886 $</div>
      </div>
      <apexchart type="line" height="200" ref="chart"
                 :options="chartOptions"
                 :series="series"></apexchart>
      <div class="bg-grey-e7 h-14 rounded-full p-1 flex items-center">
        <button v-for="tab of chartTabs" :key="tab"
                class="h-full flex-1 rounded-full text-h5"
                :class="activeTab===tab?'bg-white shadow-tab':'text-grey-6f'">{{tab}}</button>
      </div>
    </div> -->
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">{{$t('postView.tokenInfo')}}</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{ $t('postView.price') }}</span>
        <span class="text-h5 text-black-19">{{ formatPrice((comStore.currentSelectedCommunity.price ?? 0) * useStateStore().ethPrice) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.totalSupply')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(comStore.currentSelectedCommunity.totalSupply) }}</span>
      </div>
      <div v-show="!comStore.currentSelectedCommunity.isImport" class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">
          {{ $t(isPumpV9OrV10 ? 'postView.v4HookTransactionDistribution' : 'postView.socialSupply') }}
        </span>
        <span class="text-h5 text-black-19">{{ formatAmount(SocialSupply) }}</span>
      </div>
      <div v-show="!comStore.currentSelectedCommunity.isImport" class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.bindCurveSold')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(comStore.currentSelectedCommunity.bondingCurveSupply) }}</span>
      </div>
      <div v-show="!comStore.currentSelectedCommunity.isImport" class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.dexLiquidity')}}</span>
        <span class="text-h5 text-black-19">{{ formatAmount(ListSupply) }}</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.cap')}}</span>
        <span class="text-h5 text-black-19">{{ marketCapText }}</span>
      </div>
      <template v-if="showNutboxInfo">
        <div class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93 shrink-0">{{ t('postView.nutboxCommunity') }}</span>
          <div v-if="displayNutboxCommunityAddr" class="flex items-center gap-1.5">
            <span
              class="text-h5 font-medium italic text-orange-normal underline cursor-pointer"
              @click="openExplorerAddress(displayNutboxCommunityAddr)"
            >{{ formatAddress(displayNutboxCommunityAddr) }}</span>
            <button type="button" class="shrink-0 p-0.5" @click.stop="onCopy(displayNutboxCommunityAddr)">
              <img class="w-[10px] min-w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="" />
            </button>
          </div>
          <span v-else class="text-h5 text-black-19">--</span>
        </div>
        <!-- 暂时隐藏社交分发矿池 -->
        <div v-if="false" class="flex justify-between items-center h-6">
          <span class="text-h4 text-grey-93 shrink-0">{{ t('postView.socialPool') }}</span>
          <div v-if="v9SocialPoolAddr" class="flex items-center gap-1.5">
            <span
              class="text-h5 font-medium italic text-orange-normal underline cursor-pointer"
              @click="openExplorerAddress(v9SocialPoolAddr)"
            >{{ formatAddress(v9SocialPoolAddr) }}</span>
            <button type="button" class="shrink-0 p-0.5" @click.stop="onCopy(v9SocialPoolAddr)">
              <img class="w-[10px] min-w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="" />
            </button>
          </div>
          <span v-else class="text-h5 text-black-19">--</span>
        </div>
      </template>
      <div v-show="showNutboxInfo || rewardPerDay>-1" class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">{{$t('postView.rewardPerDay')}}</span>
        <div class="flex items-center gap-2">
          <span class="text-h5 font-medium italic text-orange-normal underline cursor-pointer"
                 @click="openDistributionModal">
            <template v-if="(isV9 && v9HourlyLoading) || (comStore.currentSelectedCommunity?.version === 10 && v10Loading)">...</template>
            <template v-else>{{ formatAmount(rewardPerDay) }}</template>
          </span>
          <button v-if="isHourly"
                  class="text-xs px-2 py-0.5 rounded-full bg-orange-normal text-white hover:bg-orange-600 transition-colors"
                  @click="openInjectModal">
            {{ $t('postView.injectRewards') }}
          </button>
        </div>
      </div>

    </div>
    <!-- <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">Tweet Pool</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Content and Interaction</span>
        <span class="text-h5 text-black-19">60%(0.236M)</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Space</span>
        <span class="text-h5 text-black-19">40%(0.084M)</span>
      </div>
      <div class="my-1">
        <div class="text-h4 text-grey-93 mb-1">Social Distribution Strategy</div>
        <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden">
          <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                      placement="top-start">
            <template #content>
              <span class="text-xs">{{data.amount}}</span>
            </template>
            <div class="h-full"
                 :style="{ flex: 1,  background: data.background}" >
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Unclaimed Reward:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="123"
                 type="text" id="reward">
          <span class="text-h3">$ LATC</span>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Pool Contract:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="'0x3475...3880'" disabled type="text" id="reward">
        </div>
      </div>
    </div> -->
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">{{$t('postView.holderList')}}</div>
      <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
        @load="onLoad"
      >
      <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
           v-for="(holder, i) of holdingList" :key="i">
          <div class="col-span-3 truncate flex items-center gap-1">
            <span class="min-w-4">{{i + 1}}</span>
            <UserAvatar :profile-img="holder.profile" :name="holder.twitterName" :username="holder.twitterUsername"
                    :followers="holder.followers" :followings="holder.followings"
                    :eth-addr="holder.ethAddr" :credit="0"
                    :steem-id="holder.steemId" :teleported="true">
              <template #avatar-img>
                <img v-if="holder.profile"
                 class="w-4 h-4 min-w-4 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" @error="replaceEmptyImg" :src="holder.profile"
                 alt="">
            <img v-else
                 class="w-4 h-4 min-w-4 rounded-full cursor-pointer bg-color2A"
                 @click.stop="onUserAvatar" src="~@/assets/icons/icon-default-avatar.svg" alt="">
              </template>
            </UserAvatar>
            <!-- <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt=""> -->
            <span class="">{{ formatAddress(holder.ethAddr) }}</span>
            <span v-show="holder.ethAddr == comStore.currentSelectedCommunity.token" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">{{ $t('postView.contract') }}</span>
            <span v-show="holder.ethAddr == comStore.currentSelectedCommunity.creator" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">{{ $t('postView.deployer') }}</span>
            <!-- v9：PCS V4 流动性合约 -->
            <span v-show="isV9 && isPcsV4Holder(holder.ethAddr)" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">{{ $t('postView.pcsV4') }}</span>
            <!-- 旧版 Uniswap V2 pair -->
            <span v-show="!isV9 && holder.ethAddr == comStore.currentSelectedCommunity.pair" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">DEX</span>
            <span v-show="holder.ethAddr == '0x3758AA66caD9F2606F1F501c9CB31b94b713A6d5'" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">NerveNetwork: Bridge</span>
            <span v-show="holder.ethAddr == '0x4daB069f85441f48bB1b1224d6C41D2301451C69' && comStore.currentSelectedCommunity.tick == 'BUIDL'" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">Community Fund</span>
            <!-- v9：Hook 持有社交分配代币 -->
            <span v-show="isV9 && isSameAddr(holder.ethAddr, v9HookAddr)" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">{{ $t('postView.swapHook') }}</span>
            <!-- v9：Nutbox 社区合约 -->
            <span v-show="isV9 && isSameAddr(holder.ethAddr, v9NutboxCommunityAddr)" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">{{ $t('postView.nutbox') }}</span>
            <!-- v1–v7：Pump 社交分发合约 -->
            <span v-show="!isV9 && legacyPumpAddrs.includes(holder.ethAddr)" class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">Social Distribution</span>
          </div>
        <span class="col-span-2 text-right">{{ formatAmount(holder.amount) }} / {{ ((holder.amount as number) / 10000000).toFixed(2) }}%</span>
      </div>
      </van-list>
    </van-pull-refresh>

    </div>
    <el-dialog v-model="showDistributionModal"
               modal-class="overlay-white"
               class="max-w-[720px] w-[92vw] rounded-[20px]"
               width="720px" :show-close="false" align-center destroy-on-close
               @opened="onDistributionModalOpened">
      <!-- 标题区域 -->
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-grey-e7">
        <h3 class="text-h2 font-semibold text-black-19">{{ $t('postView.rewardDistributionSchedule') }}</h3>
        <button @click="showDistributionModal = false" 
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-grey-e7 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 可滚动内容区域 -->
      <div ref="distributionScrollRef" class="overflow-y-auto pr-2 custom-scrollbar" style="max-height: 60vh;">
        <!-- HourlyTickCalculator：按日分发柱状图（v9 / v10） -->
        <div
          v-if="isHourly"
          class="distribution-chart-card mb-6 p-4 rounded-xl border"
          :style="{
            backgroundColor: isDark ? '#1a1c22' : '#fff7ed',
            borderColor: isDark ? 'rgba(255, 143, 64, .28)' : 'rgba(255, 143, 64, .3)',
          }"
        >
          <div class="text-h4 font-semibold text-black-19 mb-1">{{ $t('postView.hourlyDistributionTitle') }}</div>
          <div class="text-xs text-grey-93 mb-4">{{ $t('postView.hourlyDistributionDesc') }}</div>
          <div v-if="v9HourlyLoading || v10Loading" class="py-8 text-center text-grey-93 text-h4">{{ $t('loading') }}</div>
          <div v-else-if="v9HourlyAmounts.length > 0">
            <component
              :is="ApexCharts"
              :key="isDark ? 'distribution-dark' : 'distribution-light'"
              type="bar"
              height="220"
              :options="hourlyBarOptions"
              :series="hourlyBarSeries"
            />
            <div class="mt-3 flex justify-between text-h5 text-grey-93">
              <span>{{ $t('postView.rewardPerDay') }}</span>
              <span class="font-semibold text-orange-normal">
                {{ formatAmount(rewardPerDay) }} {{ comStore.currentSelectedCommunity?.tick }}
              </span>
            </div>
          </div>
          <div v-else class="py-8 text-center text-grey-93 text-h4">{{ $t('postView.noDistributionData') }}</div>
        </div>

        <!-- LinearTimeCalculator / 静态分发：时间戳时间轴 -->
        <div v-if="!isHourly && !isV10Block && timelineDistribution.length > 0" class="relative pl-4">
          <!-- 时间轴线 -->
          <div class="absolute left-[7px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-orange-normal via-purple-500 to-blue-active"></div>

          <!-- 时间线记录 -->
          <div v-for="(item, index) in timelineDistribution" :key="index"
               :ref="(el) => setPhaseRef(el, Number(index))"
               class="relative mb-6 last:mb-0">
            <!-- 时间轴连接点 -->
            <div class="absolute left-[-16px] top-2 w-4 h-4 rounded-full border-3 bg-white z-10"
                 :class="isCurrentPeriod(item.start, item.end) ? 'border-orange-normal shadow-lg shadow-orange-normal/50' : 'border-grey-c9'">
              <!-- 当前进行中的周期，添加脉冲动画 -->
              <div v-if="isCurrentPeriod(item.start, item.end)"
                   class="absolute inset-0 rounded-full bg-orange-normal animate-ping opacity-75"></div>
            </div>

            <!-- 记录卡片 -->
            <div class="ml-6 p-4 rounded-xl bg-white border transition-all duration-300"
                 :class="isCurrentPeriod(item.start, item.end)
                   ? 'border-orange-normal bg-orange-50 shadow-md'
                   : 'border-grey-e7 hover:shadow-sm'">

              <!-- 当前标签 -->
              <div v-if="isCurrentPeriod(item.start, item.end)"
                   class="inline-flex items-center gap-1 px-2 py-0.5 mb-2 text-xs font-medium text-white bg-orange-normal rounded-full">
                <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                {{ $t('postView.ongoing') }}
              </div>

              <!-- 奖励金额 -->
              <div class="mb-3">
                <div class="text-xs text-grey-93 mb-1">{{ $t('postView.rewardPerDay') }}</div>
                <div class="text-xl font-bold"
                     :class="isCurrentPeriod(item.start, item.end) ? 'text-orange-normal' : 'text-black-19'">
                  {{ (Math.ceil(item.amount * 86400)).toLocaleString() }}
                  <span class="text-sm font-normal text-grey-93 ml-1">{{ comStore.currentSelectedCommunity?.tick }}</span>
                </div>
              </div>

              <!-- 时间范围 -->
              <div class="flex items-center gap-3 text-h5">
                <div class="flex items-center gap-1.5 flex-1">
                  <svg class="w-4 h-4 text-grey-93" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <div class="flex flex-col">
                    <span class="text-[10px] text-grey-93">{{ $t('postView.startDate') }}</span>
                    <span class="text-h5 text-black-19">{{ formatDate(item.start * 1000) }}</span>
                  </div>
                </div>

                <div class="flex items-center text-grey-c9">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>

                <div class="flex items-center gap-1.5 flex-1">
                  <svg class="w-4 h-4 text-grey-93" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <div class="flex flex-col">
                    <span class="text-[10px] text-grey-93">{{ $t('postView.endDate') }}</span>
                    <span class="text-h5 text-black-19">{{ formatDate(item.end * 1000) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- LinearCalculator：区块时间轴 -->
        <div v-if="isV10Block && timelineDistribution.length > 0" class="relative pl-4">
          <!-- 时间轴线 -->
          <div class="absolute left-[7px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-orange-normal via-purple-500 to-blue-active"></div>

          <!-- 区块线记录 -->
          <div v-for="(item, index) in timelineDistribution" :key="index"
               :ref="(el) => setPhaseRef(el, Number(index))"
               class="relative mb-6 last:mb-0">
            <!-- 时间轴连接点 -->
            <div class="absolute left-[-16px] top-2 w-4 h-4 rounded-full border-3 bg-white z-10"
                 :class="isCurrentPeriod(item.start, item.end) ? 'border-orange-normal shadow-lg shadow-orange-normal/50' : 'border-grey-c9'">
              <div v-if="isCurrentPeriod(item.start, item.end)"
                   class="absolute inset-0 rounded-full bg-orange-normal animate-ping opacity-75"></div>
            </div>

            <!-- 记录卡片 -->
            <div class="ml-6 p-4 rounded-xl bg-white border transition-all duration-300"
                 :class="isCurrentPeriod(item.start, item.end)
                   ? 'border-orange-normal bg-orange-50 shadow-md'
                   : 'border-grey-e7 hover:shadow-sm'">

              <!-- 当前标签 -->
              <div v-if="isCurrentPeriod(item.start, item.end)"
                   class="inline-flex items-center gap-1 px-2 py-0.5 mb-2 text-xs font-medium text-white bg-orange-normal rounded-full">
                <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                {{ $t('postView.ongoing') }}
              </div>

              <!-- 奖励金额（per block * ~28800 blocks/day） -->
              <div class="mb-3">
                <div class="text-xs text-grey-93 mb-1">{{ $t('postView.rewardPerDay') }}</div>
                <div class="text-xl font-bold"
                     :class="isCurrentPeriod(item.start, item.end) ? 'text-orange-normal' : 'text-black-19'">
                  {{ (Math.ceil(item.amount * 28800)).toLocaleString() }}
                  <span class="text-sm font-normal text-grey-93 ml-1">{{ comStore.currentSelectedCommunity?.tick }}</span>
                </div>
              </div>

              <!-- 区块范围 -->
              <div class="flex items-center gap-3 text-h5">
                <div class="flex items-center gap-1.5 flex-1">
                  <svg class="w-4 h-4 text-grey-93" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                  <div class="flex flex-col">
                    <span class="text-[10px] text-grey-93">{{ $t('postView.startBlock') }}</span>
                    <span class="text-h5 text-black-19">#{{ item.start.toLocaleString() }}</span>
                  </div>
                </div>

                <div class="flex items-center text-grey-c9">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>

                <div class="flex items-center gap-1.5 flex-1">
                  <svg class="w-4 h-4 text-grey-93" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                  <div class="flex flex-col">
                    <span class="text-[10px] text-grey-93">{{ $t('postView.endBlock') }}</span>
                    <span class="text-h5 text-black-19">#{{ item.end.toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!isHourly && timelineDistribution.length === 0" class="py-12 text-center">
          <div class="text-grey-93 text-h4">{{ $t('postView.noDistributionData') }}</div>
        </div>
      </div>
    </el-dialog>

    <!-- Inject Rewards 弹窗 -->
    <el-dialog v-model="showInjectModal"
               modal-class="overlay-white"
               class="max-w-[480px] w-[92vw] rounded-[20px]"
               width="480px" :show-close="false" align-center destroy-on-close>
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-grey-e7">
        <h3 class="text-h2 font-semibold text-black-19">{{ $t('postView.injectRewards') }}</h3>
        <button @click="showInjectModal = false"
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-grey-e7 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="mb-4">
        <p class="text-h4 text-grey-93 leading-relaxed">{{ $t('postView.injectDesc') }}</p>
      </div>

      <!-- 未连接钱包：显示连接按钮 -->
      <template v-if="!isWalletConnected">
        <button class="w-full h-11 rounded-xl text-white text-h3 font-medium bg-orange-normal hover:bg-orange-600 transition-colors"
                @click="showInjectModal = false; modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)">
          {{ $t('connect') }}
        </button>
      </template>

      <!-- 已连接：显示注入表单 -->
      <template v-else>
        <div class="mb-4">
          <div class="flex justify-between items-center mb-1">
            <label class="text-h4 text-grey-93">{{ $t('postView.injectAmount') }}</label>
            <span class="text-xs text-grey-93">
              {{ $t('postView.balance') }}: {{ formatAmountTrunc(Number(injectTokenBalance) / 1e18) }} {{ comStore.currentSelectedCommunity?.tick }}
            </span>
          </div>
          <div class="border border-grey-c9 rounded-xl h-11 flex items-center px-4">
            <input v-model="injectAmount"
                   class="flex-1 text-h3 outline-none bg-transparent"
                   type="text"
                   inputmode="decimal"
                   :placeholder="$t('postView.injectAmountPlaceholder')" />
            <button class="text-xs text-orange-normal font-medium ml-2"
                    @click="injectAmount = formatUnits(injectTokenBalance, 18)">
              MAX
            </button>
          </div>
        </div>

        <button class="w-full h-11 rounded-xl text-white text-h3 font-medium transition-colors"
                :class="injectLoading || !injectAmount || Number(injectAmount) <= 0 ? 'bg-grey-c9 cursor-not-allowed' : 'bg-orange-normal hover:bg-orange-600'"
                :disabled="injectLoading || !injectAmount || Number(injectAmount) <= 0"
                @click="onInjectConfirm">
          <template v-if="injectLoading">{{ $t('postView.injecting') }}...</template>
          <template v-else>{{ $t('postView.confirmInject') }}</template>
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.distribution-chart-card {
  transition: background-color 180ms ease, border-color 180ms ease;
}

:global(html.dark) .distribution-chart-card :deep(.apexcharts-canvas),
:global(html.dark) .distribution-chart-card :deep(.apexcharts-svg) {
  background: transparent !important;
}

:global(html.dark) .distribution-chart-card :deep(.apexcharts-legend-text),
:global(html.dark) .distribution-chart-card :deep(.apexcharts-text) {
  color: #b6bcc7 !important;
  fill: #b6bcc7 !important;
}
</style>
