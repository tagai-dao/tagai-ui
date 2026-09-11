<script setup lang="ts">
import PageDataStatus from '@/components/common/PageDataStatus.vue'
import OnlineSpace from "@/components/common/OnlineSpace.vue";
import CommunityLogo from "@/components/common/CommunityLogo.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {type Community, GlobalModalType, ListType, MindShareType, PredictSortType, PredictType, type Space} from '@/types'
import {getCommunitiesByNew, getTokenCatalogPage, getImportedCommunityInfo, getOnlineSpaces, type TagCoinSourceFilter} from "@/apis/api";
import {useCommunityStore} from "@/stores/community";
import {useCurationStore} from '@/stores/curation'
import {handleErrorTip} from '@/utils/notify'
import {useRoute, useRouter} from "vue-router";
import {getTokenInfo} from '@/utils/pump'
import SearchBar from "@/components/common/SearchBar.vue";
import LanguageSwitcher from "@/components/common/LanguageSwitcher.vue";
import emitter from "@/utils/emitter";
import {usePageScroll} from "@/composables/useTools";
import {formatPrice} from "../utils/helper";
import {formatUsdCompact} from "@/utils/format";
import {useModalStore, useStateStore} from "@/stores/common";
import HomePost from "@/views/home/HomePost.vue";
import PostTypeOption from "@/views/home/PostTypeOption.vue";
import MindShare from "@/views/mind-share/MindShare.vue";
import {useAccountStore} from "@/stores/web3";
import {useChainStore} from "@/stores/chain";
import Predict from "@/views/predict/Index.vue";
import TokenWatchlist from '@/views/home/TokenWatchlist.vue'
import BasketsListView from '@/views/baskets/BasketsListView.vue'
import {type HomeNewSource, TweetListType, useTweetsStore} from "@/stores/tweets";
import {filterByActiveChain} from "@/utils/chainFilter";
import {isBStockCommunity, refreshRobinhoodBStockRegistry, registerRobinhoodStockCommunities} from '@/config/bstocks'
import {externalSourceLogos, type AccountOrigin} from '@/assets/externalSourceLogos'
import { readPublicSnapshot, writePublicSnapshot } from '@/utils/publicSnapshot'

const listType = ref(ListType.Trending)
const mindShareType = ref<MindShareType>(MindShareType.Project) // 1: project, 0: user
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
// Page rankings belong to this route and filter. Other widgets may refresh the
// shared community store, but must never replace the selected ranking.
const coinLists = reactive({
  marketCapCommunities: [] as Community[],
  newCommunities: [] as Community[],
  trendingCommunities: [] as Community[],
})
const recentCommunities = ref<Community[]>([])
let pageActive = true
const curationStore = useCurationStore();
const tweetsStore = useTweetsStore();
const refreshing = ref(false);
// Only a user pull should move the list to reveal the refresh indicator.
const pullRefreshing = ref(false);
const loading = ref(false);
const loadFailed = ref(false);
const listLoaded = ref(false);
const router = useRouter();
const stateStore = useStateStore();
const chainStore = useChainStore();
const finished = reactive({
  [ListType.MarketCap]: false,
  [ListType.Trending]: false,
  [ListType.New]: false,
})
const { pageScroll, pageScrollTo} = usePageScroll()
const pageScrollRef = ref()
const activeTab = computed({
  get: () => stateStore.activeHomeTab,
  set: (val: any) => stateStore.setActiveHomeTab(val)
})

// 主菜单和子菜单
const activeMainMenu = computed(() => stateStore.activeMainMenu)
const tagSubMenu = computed(() => stateStore.tagSubMenu)
const coinSubMenu = computed(() => stateStore.coinSubMenu)
type TagCoinSource = TagCoinSourceFilter
const tagCoinSource = ref<TagCoinSource>('all')
const tagCoinSourceTabs: Array<{ value: TagCoinSource; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'memeetf', label: 'Meme ETF' },
  { value: 'launch', label: 'Social Launch' },
  { value: 'import', label: 'Imported Token' },
]
const bStockCommunities = ref<Community[]>([])
const bStocksLoading = ref(false)
const bStocksFailed = ref(false)
const bStocksLoaded = ref(false)
let bStocksLoadedAt = 0
const homeNewSources: Array<{ value: HomeNewSource; label: string; logo: AccountOrigin }> = [
  { value: 'x', label: 'All Feed', logo: 'X' },
  { value: 'fomo', label: 'FOMO', logo: 'FOMO' },
  { value: 'gmgn', label: 'GMGN', logo: 'GMGN' },
  { value: 'pump', label: 'Pump', logo: 'PUMP' },
]

const isActiveChainBStock = (community: Community) =>
  isBStockCommunity(community, chainStore.activeChainId)

let backgroundIntervals: ReturnType<typeof setInterval>[] = []
let tickerSequence = 0

watch(listType, () => { void refresh() })
watch(activeTab, (val) => {
  // 标签页切换时的处理
  console.log('Active tab changed to:', val)
})

let listRefreshSequence = 0
const coinListSnapshotScope = (chainId: number, type: ListType, source: TagCoinSource) =>
  `${chainId}:token-list:${type}:${source}`

function saveCoinListSnapshot(chainId: number, type: ListType, source: TagCoinSource, rows: Community[]) {
  if (rows.length) writePublicSnapshot(coinListSnapshotScope(chainId, type, source), rows.slice(0, 120))
}

const coinListKey = (type: ListType) =>
  type === ListType.MarketCap ? 'marketCapCommunities' : type === ListType.New ? 'newCommunities' : 'trendingCommunities'

const catalogSort = (type: ListType) => type === ListType.New ? 'new' : type === ListType.MarketCap ? 'marketCap' : 'trending'
const cursors = new Map<ListType, { page: number; catalogId: string }>()
const coinListRef = ref<{ check: () => void }>()
function mergeCoins(existing: Community[], incoming: Community[]) {
  const rows = new Map(existing.map(row => [row.token?.toLowerCase() || row.tick, row]))
  for (const row of incoming) rows.set(row.token?.toLowerCase() || row.tick, row)
  return [...rows.values()]
}

async function refresh() {
  if (!pageActive) return
  loading.value = false
  loadFailed.value = false
  refreshing.value = true
  const sequence = ++listRefreshSequence
  const chainId = chainStore.activeChainId
  const type = listType.value
  const source = tagCoinSource.value
  const key = coinListKey(type)
  const isCurrent = () => pageActive && sequence === listRefreshSequence
    && chainId === chainStore.activeChainId
    && source === tagCoinSource.value
    && type === listType.value
  try {
    finished[type] = false
    const result = await getTokenCatalogPage(catalogSort(type), source)
    const communities = result.rows
    if (!isCurrent()) return
    coinLists[key] = communities || []
    saveCoinListSnapshot(chainId, type, source, coinLists[key])
    listLoaded.value = true
    finished[type] = !result.hasMore
    cursors.set(type, { page: result.nextPage, catalogId: result.catalogId })
    void getTokenInfo(communities).then(rows => {
      if (!isCurrent()) return
      const byToken = new Map(rows.map(row => [row.token.toLowerCase(), row]))
      coinLists[key] = coinLists[key].map(row => byToken.get(row.token.toLowerCase()) ?? row)
    }).catch(error => console.warn('[Token] optional metrics unavailable', error))
  } catch (error) {
    if (isCurrent()) {
      const existing = coinLists[key]
      const cached = readPublicSnapshot<Community[]>(coinListSnapshotScope(chainId, type, source))
      if (existing?.length) {
        listLoaded.value = true
        loadFailed.value = true
        console.warn(`[Token] ${ListType[type]} refresh failed; retaining current list`, error)
      } else if (cached?.length) {
        coinLists[key] = cached
        listLoaded.value = true
        loadFailed.value = true
      } else {
        loadFailed.value = true
        handleErrorTip(error)
      }
    }
  } finally {
    if (isCurrent()) refreshing.value = false
  }
}

async function loadMore() {
  const type = listType.value
  if (!pageActive || loading.value || refreshing.value || loadFailed.value || finished[type]) return
  const cursor = cursors.get(type)
  if (!cursor) return // Cached display rows are not a pagination cursor.
  const sequence = listRefreshSequence
  const chainId = chainStore.activeChainId
  const source = tagCoinSource.value
  const isCurrent = () => pageActive && sequence === listRefreshSequence && type === listType.value
    && chainId === chainStore.activeChainId && source === tagCoinSource.value
  loading.value = true
  try {
    const result = await getTokenCatalogPage(catalogSort(type), source, cursor.page, cursor.catalogId)
    if (!isCurrent()) return
    const key = coinListKey(type)
    coinLists[key] = mergeCoins(coinLists[key], result.rows)
    cursors.set(type, { page: result.nextPage, catalogId: result.catalogId })
    finished[type] = !result.hasMore
    saveCoinListSnapshot(chainId, type, source, coinLists[key])
    void getTokenInfo(result.rows).then(rows => {
      if (!isCurrent()) return
      const byToken = new Map(rows.map(row => [row.token.toLowerCase(), row]))
      coinLists[key] = coinLists[key].map(row => byToken.get(row.token.toLowerCase()) ?? row)
    }).catch(error => console.warn('[Token] optional page metrics unavailable', error))
  } catch (error) {
    if (!isCurrent()) return
    loadFailed.value = true
    handleErrorTip(error)
  } finally {
    if (isCurrent()) loading.value = false
  }
}

async function getSpaces() {
  try{
    let spaces = await getOnlineSpaces() as Space[];

    if (spaces && spaces.length > 0) {
      curationStore.allSpaces = spaces.filter(space => space.twitterId !== "1487723839693852673")
    }else {
      curationStore.allSpaces = [];
    }
  } catch(e) {
    // handleErrorTip(e)
  }
}

async function getNewCommunities() {
  if (!pageActive) return
  const chainId = chainStore.activeChainId
  const sequence = ++tickerSequence
  const isCurrent = () => pageActive && sequence === tickerSequence && chainId === chainStore.activeChainId
  try {
    const communities = await getCommunitiesByNew(0, 'all') as Community[]
    if (!isCurrent()) return
    recentCommunities.value = communities.slice(0, 10)
    void getTokenInfo(recentCommunities.value).then(rows => {
      if (isCurrent()) recentCommunities.value = rows
    }).catch(error => console.warn('[Token] ticker metrics unavailable', error))
  } catch (error) {
    if (isCurrent()) console.warn('[Token] ticker refresh failed; retaining last list', error)
  }
}

/** 两条链均按官方 CA 元数据分类；本地快照和 RH 路由只用于容灾。 */
async function loadBStocks(force = false) {
  if (bStocksLoading.value || (bStocksLoaded.value && !force && Date.now() - bStocksLoadedAt < 60_000)) return
  const chainId = chainStore.activeChainId
  try {
    bStocksLoading.value = true
    bStocksFailed.value = false
    const imported = filterByActiveChain((await getImportedCommunityInfo() || []) as Community[])
    if (chainId !== chainStore.activeChainId) return
    if (chainStore.deployment.key === 'rh') {
      registerRobinhoodStockCommunities(imported)
      void refreshRobinhoodBStockRegistry(imported.map((community) => community.token), { force }).then(() => {
        if (chainId !== chainStore.activeChainId) return
        const current = new Map(bStockCommunities.value.map(row => [row.token.toLowerCase(), row]))
        bStockCommunities.value = imported.filter(isActiveChainBStock).map(row => current.get(row.token.toLowerCase()) ?? row)
      }).catch(error => {
        // API official-stock metadata remains authoritative when RH RPC is unavailable.
        console.error('Load RH Router-supported stocks error:', error)
      })
    }
    const bStocks = imported.filter(isActiveChainBStock)
    // 先展示 API 数据；链上补价失败时也不隐藏已识别的 bStocks。
    bStockCommunities.value = bStocks
    bStocksLoaded.value = true
    bStocksLoadedAt = Date.now()
    if (bStocks.length) {
      try {
        const enriched = await getTokenInfo(bStocks)
        if (chainId !== chainStore.activeChainId) return
        const current = new Map(enriched.map(row => [row.token.toLowerCase(), row]))
        bStockCommunities.value = bStockCommunities.value.map(row => current.get(row.token.toLowerCase()) ?? row)
      } catch (e) {
        console.error('Hydrate bStocks on-chain data failed:', e)
      }
    }
  } catch (e) {
    bStocksFailed.value = true
    handleErrorTip(e)
  } finally {
    bStocksLoading.value = false
  }
}

async function refreshBStocks() {
  bStocksFailed.value = false
  refreshing.value = true
  try {
    await loadBStocks(true)
  } finally {
    refreshing.value = false
  }
}

async function onPullRefresh() {
  try {
    if (coinSubMenu.value === 'bStocks') await refreshBStocks()
    else await refresh()
  } finally {
    pullRefreshing.value = false
  }
}

/** 仅在 Coin 列表可见时拉数据，避免 Tag 首页抢 RPC */
function ensureCoinListLoaded() {
  if (!pageActive || activeMainMenu.value !== 'coin') return
  // RH needs the official stock registry classification even while TagCoin is
  // selected, so stock tokens are excluded from that sibling list as well.
  if (chainStore.deployment.key === 'rh') void loadBStocks()
  if (coinSubMenu.value === 'bStocks') {
    void loadBStocks()
    return
  }
  if (coinSubMenu.value !== 'tagCoin') return
  const list = currentCoinList.value
  if ((!list || list.length === 0 || !cursors.has(listType.value)) && !refreshing.value) {
    void refresh()
  }
}

function retryVisibleList() {
  if (!pageActive || activeMainMenu.value !== 'coin') return
  if (coinSubMenu.value === 'bStocks') void refreshBStocks()
  else if (coinSubMenu.value === 'tagCoin') void refresh()
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}

// 当前排序对应的列表（finished 文案据此判断，避免"加载完毕"被静默吞掉）
const currentCoinList = computed(() => {
  if (listType.value == ListType.MarketCap) return coinLists.marketCapCommunities
  if (listType.value == ListType.New) return coinLists.newCommunities
  return coinLists.trendingCommunities
})

const coinListTypeOptions = computed(() => [
  { value: ListType.MarketCap, labelKey: 'marketCap' },
  { value: ListType.Trending, labelKey: 'trending' },
  { value: ListType.New, labelKey: 'new' },
])
const currentCoinListTypeLabelKey = computed(() =>
  coinListTypeOptions.value.find(option => option.value === listType.value)?.labelKey ?? 'marketCap',
)
function selectCoinListType(value: ListType) {
  if (coinListTypeOptions.value.some(option => option.value === value)) listType.value = value
}

const isImportedToken = (community: Community) =>
  community.isImport === true || Number(community.isImport) === 1

/** TagCoin 排除股票，并按 MemeETF / Social Launch / 外部导入分组。 */
function filterTagCoins(list: Community[]) {
  return list.filter((community) => {
    if (isActiveChainBStock(community)) return false
    if (tagCoinSource.value === 'all') return true
    if (tagCoinSource.value === 'memeetf') return Number(community.version) === 13
    return tagCoinSource.value === 'import'
      ? isImportedToken(community)
      : !isImportedToken(community) && Number(community.version) !== 13
  })
}

function switchTagCoinSource(source: TagCoinSource) {
  if (tagCoinSource.value === source) return
  tagCoinSource.value = source
  clearCoinLists()
  const key = coinListKey(listType.value)
  const cached = readPublicSnapshot<Community[]>(
    coinListSnapshotScope(chainStore.activeChainId, listType.value, source)
  )
  coinLists[key] = cached ?? []
  listLoaded.value = !!cached?.length
  loadFailed.value = false
  finished[listType.value] = false
  pageScrollRef.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
  void refresh()
}

// Filtering can leave a full API page with zero/one visible card and no
// scrollbar. Ask Vant to fill the viewport rather than waiting for a scroll.
watch([() => filterTagCoins(currentCoinList.value).length, loading, refreshing, listType],
  () => { void nextTick(() => coinListRef.value?.check()) })

// Coin 子 Tab 切换：状态 + URL query 双向同步（支持 ?tab=bstocks / ?tab=ip 深链）
const route = useRoute()
function switchCoinTab(tab: 'watchlist' | 'tagCoin' | 'baskets' | 'bStocks') {
  stateStore.setCoinSubMenu(tab)
  if (route.name === 'home') {
    router.replace({ query: { ...route.query, tab: tab.toLowerCase() } })
  }
  ensureCoinListLoaded()
}


function startBackgroundRefresh() {
  if (backgroundIntervals.length) return
  void getSpaces()
  void getNewCommunities()
  backgroundIntervals = [
    setInterval(getSpaces, 20000),
    setInterval(() => {
      if (activeMainMenu.value === 'coin' && coinSubMenu.value === 'bStocks') void loadBStocks()
    }, 60000),
    setInterval(getNewCommunities, 60000),
  ]
}

function stopBackgroundRefresh() {
  pullRefreshing.value = false
  backgroundIntervals.forEach(interval => clearInterval(interval))
  backgroundIntervals = []
  pageActive = false
  listRefreshSequence++
  tickerSequence++
  refreshing.value = false
  loading.value = false
}

function clearCoinLists() {
  pullRefreshing.value = false
  listRefreshSequence++
  coinLists.marketCapCommunities = []
  coinLists.newCommunities = []
  coinLists.trendingCommunities = []
  finished[ListType.MarketCap] = false
  finished[ListType.New] = false
  finished[ListType.Trending] = false
  cursors.clear()
  listLoaded.value = false
  loadFailed.value = false
  refreshing.value = false
  loading.value = false
}

onMounted(() => {
  window.addEventListener('online', retryVisibleList)
  ensureCoinListLoaded()
  startBackgroundRefresh()
  emitter.on('newCommunity', retryVisibleList)
})

watch([activeMainMenu, coinSubMenu], () => {
  ensureCoinListLoaded()
})

watch(() => chainStore.activeChainId, () => {
  clearCoinLists()
  tickerSequence++
  recentCommunities.value = []
  if (pageActive) void getNewCommunities()
  bStockCommunities.value = []
  bStocksLoaded.value = false
  ensureCoinListLoaded()
})

onActivated(() => {
  pageActive = true
  startBackgroundRefresh()
  ensureCoinListLoaded()
  if(pageScrollRef.value)
  pageScrollTo(pageScrollRef.value)
})

onDeactivated(stopBackgroundRefresh)
onUnmounted(() => {
  window.removeEventListener('online', retryVisibleList)
  stopBackgroundRefresh()
  emitter.off('newCommunity', retryVisibleList)
})

const duration = computed(() => {
  const totalWidth = curationStore.allSpaces.length * 320
  return (totalWidth / 80) * 1000
})

const contentWidth = computed(() => {
  return curationStore.allSpaces.length * 320;
})

const scrollContainer = ref()
const needScroll = ref(true)
watch([() => contentWidth.value, () => scrollContainer.value], () => {
  if(!scrollContainer.value) return
  needScroll.value = contentWidth.value>scrollContainer.value.clientWidth
  })
  
  const scrollNewCommunities = computed(() => {
  return recentCommunities.value
})

const newComDuration = computed(() => {
  // 移动端卡片宽度是 180px（360px / 2），PC 端是 120px
  const cardWidth = 180 // 移动端缩小到1/2
  const totalWidth = scrollNewCommunities.value.length * cardWidth
  // 速度降低到1/2，意味着动画时间需要增加2倍
  return (totalWidth / cardWidth) * 1000 * 2
})

const newComContentWidth = computed(() => {
  // 移动端卡片宽度是 180px（360px / 2），PC 端是 120px
  const cardWidth = 180 // 移动端缩小到1/2
  return scrollNewCommunities.value.length * cardWidth;
})

const newComNeedScroll = ref(true)
watch([() => newComContentWidth.value, () => scrollContainer.value], () => {
  if(!scrollContainer.value) return
  newComNeedScroll.value = newComContentWidth.value>scrollContainer.value.clientWidth
})

const accStore = useAccountStore();
// Session restoration must not replace the default Coin tab or an explicit tab.
const modalStore = useModalStore()
const onCreate = (type: GlobalModalType) => {
  if (!accStore.getAccountInfo?.twitterId && type == GlobalModalType.CreateTweet) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return;
  }
  modalStore.setModalVisible(true, type)
}

</script>

<template>
  <div class="h-full min-h-0 overflow-hidden pb-2 flex flex-col gap-3 pt-2 w-full">
    <PageDataStatus :paths="['/community/communit', '/community/getImportedCommunityInfo']" @retry="retryVisibleList" @updated="!refreshing && retryVisibleList()" />
    <!-- 新社区列表（TagCoin 滚动条）- 移动端显示在 Space 滚动条上方，PC 端隐藏（PC 端在右侧显示 Top TagCoin） -->
    <div v-if="activeMainMenu==='tag'" class="h-[42px] web:h-[16px] web:hidden px-3 pb-2 flex-shrink-0">
      <div class="w-full overflow-x-hidden whitespace-nowrap relative h-full">
        <div class="flex h-full" :class="newComNeedScroll?'scroll-content':''"
             :style="{ width: `${newComContentWidth}px`, animationDuration: `${newComDuration}ms`, animationDelay: '2s' }">
          <div class="w-[144px] min-w-[144px] flex justify-end h-full" @click="gotoDetail(community)"
               v-for="(community, index) in (newComNeedScroll?scrollNewCommunities.concat(scrollNewCommunities):scrollNewCommunities)"
               :key="index">
            <div class="h-full pl-[10px] pr-[18px] rounded-lg shadow-sm bg-white w-full max-w-[138px] flex items-center gap-[18px]">
              <CommunityLogo
                :logo="community.logo"
                size="sm"
                :shadow="false"
                class="z-30 web:!w-4 web:!h-4 web:!min-w-4 web:!min-h-4"
              />
              <div class="flex flex-col items-start justify-center gap-0.5 flex-1 min-w-0">
                <div class="text-sm font-bold leading-tight truncate w-full" :class="community.listed ? 'text-orange-normal' : 'text-black'">{{community.tick}}</div>
                <span class="text-sm font-bold text-black truncate w-full">{{ formatUsdCompact(parseFloat(community.marketCap as any) * stateStore.ethPrice) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-red-normal w-[90px] h-[12px] web:w-[80px] web:h-[10px] flex justify-center items-center
                absolute top-[3px] left-[12px] transform -translate-x-1/2 -translate-y-1/2 -rotate-45
                whitespace-nowrap">
          <div class="blinking-text text-white text-[12px] web:text-[10px] font-bold leading-none">New</div>
        </div>
      </div>
    </div>
    
    <!-- Space 滚动条 - 仅在移动端显示 -->
    <div v-if="activeMainMenu==='tag'" class="web:hidden px-3">
      <div class="relative flex overflow-hidden">
        <div class="w-full overflow-x-hidden whitespace-nowrap relative">
          <div class="flex" :class="needScroll?'scroll-content':''"
               :style="{ width: `${contentWidth}px`, animationDuration: `${duration}ms`, animationDelay: '2s' }">
            <div class="w-[320px] min-w-[320px] flex justify-end"
                 v-for="(space, index) in (needScroll?curationStore.allSpaces.concat(curationStore.allSpaces):curationStore.allSpaces)"
                 :key="index">
              <OnlineSpace @click="$router.push('/space-detail/' + space.tweetId)" :space/>
            </div>
          </div>
        </div>
        <div class="bg-black w-[100px] h-[14px] flex justify-center items-center
                  absolute top-[15px] left-[15px] transform -translate-x-1/2 -translate-y-1/2 -rotate-45
                  whitespace-nowrap">
          <div class="blinking-text text-white text-xs font-bold">Space</div>
        </div>
      </div>
    </div>
    
    <!-- Home Feed：New 优先，并在 New 下按内容来源筛选 -->
    <div v-if="activeMainMenu==='tag'" class="px-3 web:px-3 w-full web:max-w-[1240px] web:mx-auto flex flex-col gap-2">
      <div class="flex gap-2">
        <button
          class="h-9 px-5 rounded-full text-h3 whitespace-nowrap transition-colors"
          :class="tweetsStore.homeTweetType === TweetListType.New ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="tweetsStore.homeTweetType = TweetListType.New"
        >
          {{ $t('new') || 'New' }}
        </button>
        <button
          class="h-9 px-5 rounded-full text-h3 whitespace-nowrap transition-colors"
          :class="tweetsStore.homeTweetType === TweetListType.Trending ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="tweetsStore.homeTweetType = TweetListType.Trending"
        >
          {{ $t('trending') || 'Trending' }}
        </button>
      </div>
      <div v-if="tweetsStore.homeTweetType === TweetListType.New" class="flex gap-1 overflow-x-auto no-scroll-bar">
        <button
          v-for="source in homeNewSources"
          :key="source.value"
          class="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap border transition-colors"
          :class="tweetsStore.homeNewSource === source.value
            ? 'border-orange-normal bg-orange-normal/10 text-orange-normal'
            : 'border-grey-light bg-white text-grey-5a hover:border-orange-normal/40'"
          @click="tweetsStore.homeNewSource = source.value"
        >
          <img :src="externalSourceLogos[source.logo]" :alt="`${source.label} logo`" class="w-4 h-4 rounded-full object-contain" />
          <span>{{ source.label }}</span>
        </button>
      </div>
    </div>
    
    <!-- Home 菜单：TagCoin、Baskets、链对应的股票资产 -->
    <div v-if="activeMainMenu==='coin'" class="token-navigation px-3 w-full web:max-w-[1240px] web:mx-auto flex gap-1 web:gap-2 items-center justify-between">
      <div class="token-navigation-tabs flex flex-1 web:flex-none min-w-0 justify-between web:gap-2">
        <button
          class="token-navigation-tab h-9 px-0.5 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors"
          :class="coinSubMenu==='watchlist' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('watchlist')"
        >{{ $t('watchlist.title') }}</button>
        <button
          class="token-navigation-tab h-9 px-0.5 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors"
          :class="coinSubMenu==='tagCoin' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('tagCoin')"
        >
          Coin
        </button>
        <button
          class="token-navigation-tab h-9 px-0.5 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors"
          :class="coinSubMenu==='baskets' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('baskets')"
        >
          {{ $t('baskets.menu') || 'Baskets' }}
        </button>
        <button
          class="token-navigation-tab h-9 px-0.5 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-0.5 web:gap-1.5"
          :class="coinSubMenu==='bStocks' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('bStocks')"
        >
          <img v-if="chainStore.deployment.key === 'rh'" src="~@/assets/icons/robinhood.png" class="h-3.5 web:h-5 w-auto object-contain" alt="Robinhood">
          {{ chainStore.deployment.key === 'rh' ? 'Stocks' : ($t('bStocks') || 'bStocks') }}
        </button>
      </div>
      <!-- 排序 -->
      <div class="flex-shrink-0 flex items-center gap-3">
        <el-dropdown
          v-if="coinSubMenu==='tagCoin'"
          trigger="click"
          placement="bottom-end"
          popper-class="c-select-popper rounded-xl"
          @command="selectCoinListType"
        >
          <button
            type="button"
            class="token-navigation-sort h-9 max-w-[100px] web:max-w-[120px] rounded-full bg-white px-1.5 web:px-3 inline-flex items-center justify-between gap-1 text-h3 text-black"
            aria-haspopup="menu"
          >
            <span class="truncate">{{ $t(currentCoinListTypeLabelKey) }}</span>
            <i-ep-arrow-down class="w-3.5 h-3.5 shrink-0" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="option in coinListTypeOptions"
                :key="option.value"
                :command="option.value"
                :class="option.value === listType ? 'font-bold bg-surface' : ''"
              >{{ $t(option.labelKey) }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- TagCoin 分类：All / MemeETF / Social Launch / Import Token -->
    <div
      v-if="activeMainMenu==='coin' && coinSubMenu==='tagCoin'"
      class="w-full px-3 pb-2 pt-1 web:mx-auto web:max-w-[1240px] web:pb-3 web:pt-2"
    >
      <div class="flex gap-2 overflow-x-auto no-scroll-bar" role="tablist" aria-label="TagCoin source">
        <button
          v-for="source in tagCoinSourceTabs"
          :key="source.value"
          type="button"
          role="tab"
          :aria-selected="tagCoinSource === source.value"
          class="h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors web:h-10 web:px-5"
          :class="tagCoinSource === source.value
            ? 'border-orange-normal bg-orange-normal text-white shadow-sm'
            : 'border-line bg-white text-content hover:border-orange-normal/50 hover:text-orange-normal dark:bg-surface-2'"
          @click="switchTagCoinSource(source.value)"
        >
          {{ source.label }}
        </button>
      </div>
    </div>
    
    
    <TokenWatchlist v-if="activeMainMenu==='coin' && coinSubMenu==='watchlist'" />
    <HomePost v-if="activeMainMenu==='tag'"/>
    <template v-if="activeMainMenu==='coin' && coinSubMenu==='tagCoin'">
      <div class="flex-1 min-h-0 px-3 mobile-scroll-container no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <div v-if="chainStore.deployment.key === 'rh' && tagCoinSource === 'memeetf'"
             class="flex min-h-[280px] items-center justify-center py-16 text-xl font-semibold text-content/60"
             role="status">
          Coming soon
        </div>
        <van-pull-refresh v-else v-model="pullRefreshing" @refresh="onPullRefresh"
                          class="min-h-full web:max-w-[1240px] web:mx-auto"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <van-list ref="coinListRef" :loading="loading"
                    :error="loadFailed"
                    @update:error="(value: boolean) => { if (!value) void refresh() }"
                    :finished="finished[listType]"
                    :immediate-check="false"
                    :loading-text="$t('loading')"
                    :finished-text="filterTagCoins(currentCoinList).length==0?'':$t('noMore')"
                    :offset="50"
                    @load="loadMore">

            <div v-if="refreshing && currentCoinList.length === 0" class="flex justify-center py-10" role="status">
              <i-ep-loading class="animate-spin w-7 h-7 text-orange-normal" />
              <span class="ml-2">{{ $t('loading') }}</span>
            </div>
            <div v-if="listLoaded && !refreshing && !loadFailed && filterTagCoins(coinLists.trendingCommunities).length == 0 && !loading && listType == ListType.Trending"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.Trending"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(coinLists.trendingCommunities)" :community :key="community.tick" @click="gotoDetail(community)" />
            </div>
            <div v-if="listLoaded && !refreshing && !loadFailed && filterTagCoins(coinLists.newCommunities).length == 0 && !loading && listType == ListType.New"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.New"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(coinLists.newCommunities)" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
            </div>
            <div v-if="listLoaded && !refreshing && !loadFailed && filterTagCoins(coinLists.marketCapCommunities).length == 0 && !loading && listType == ListType.MarketCap"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.MarketCap"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(coinLists.marketCapCommunities)" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
            </div>
          </van-list>
        </van-pull-refresh>
      </div>
    </template>
    <div v-if="activeMainMenu==='coin' && coinSubMenu==='baskets'" class="flex-1 min-h-0 overflow-hidden">
      <BasketsListView />
    </div>
    <template v-if="activeMainMenu==='coin' && coinSubMenu==='bStocks'">
      <div class="flex-1 min-h-0 px-3 mobile-scroll-container no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <van-pull-refresh v-model="pullRefreshing" @refresh="onPullRefresh"
                          class="min-h-full web:max-w-[1240px] web:mx-auto"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <div v-if="bStocksLoading && bStockCommunities.length === 0" class="flex justify-center py-10 w-full">
            <i-ep-loading class="animate-spin w-7 h-7 text-orange-normal" />
          </div>
          <div v-else-if="bStocksLoaded && !bStocksFailed && bStockCommunities.length === 0" class="flex justify-center py-6 w-full">
            <img src="~@/assets/images/empty-data.svg" alt="">
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
            <TagListItem v-for="community of bStockCommunities" :community :key="community.tick" @click="gotoDetail(community)" />
          </div>
        </van-pull-refresh>
      </div>
    </template>
    <Predict :type="0" v-if="activeMainMenu==='prediction' || (activeMainMenu==='tag' && tagSubMenu==='prediction')"/>
    <MindShare :mindShareType="mindShareType" v-if="activeTab==='mindshare'"/>
    
    <div>
      <button v-if="activeMainMenu==='coin' && coinSubMenu==='tagCoin'"
              class="absolute bottom-[80px] right-[10px] web:bottom-8"
              @click="onCreate(GlobalModalType.CreateCoin)">
        <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
      </button>
      <button v-else-if="activeMainMenu==='tag'"
              class="absolute bottom-[80px] right-[10px] web:bottom-8"
              @click="onCreate(GlobalModalType.CreateTweet)">
        <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
      </button>
    </div>
  </div>
</template>

<style lang="scss">

@media (max-width: 803px) {
  .token-navigation .token-navigation-tab,
  .token-navigation .token-navigation-sort {
    font-size: clamp(12px, calc(7.273vw - 11.273px), 16px);
  }
  .token-navigation-tab {
    flex-shrink: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.scroll-content {
  display: inline-block;
  animation: scroll linear infinite
}
.scroll-content:hover {
  animation-play-state: paused;
}

@keyframes scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}

.blinking-text {
  animation: blink 0.2s linear infinite;
}
@keyframes blink {
  50% { opacity: 0.2; }
}

</style>
