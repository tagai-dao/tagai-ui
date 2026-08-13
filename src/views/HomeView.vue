<script setup lang="ts">
import OnlineSpace from "@/components/common/OnlineSpace.vue";
import CommunityLogo from "@/components/common/CommunityLogo.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {computed, onActivated, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {type Community, GlobalModalType, ListType, MindShareType, PredictSortType, PredictType, type Space} from '@/types'
import {getCommunitiesByNew, getCommunitiesByTrending, getCommunityByMarketCap, getImportedCommunityInfo, getOnlineSpaces} from "@/apis/api";
import {useCommunityStore} from "@/stores/community";
import {useCurationStore} from '@/stores/curation'
import {handleErrorTip} from '@/utils/notify'
import {useRoute, useRouter} from "vue-router";
import {getTokenInfo} from '@/utils/pump'
import SearchBar from "@/components/common/SearchBar.vue";
import LanguageSwitcher from "@/components/common/LanguageSwitcher.vue";
import emitter from "@/utils/emitter";
import {useInterval, usePageScroll} from "@/composables/useTools";
import {formatPrice} from "../utils/helper";
import {formatUsdCompact} from "@/utils/format";
import {useModalStore, useStateStore} from "@/stores/common";
import HomePost from "@/views/home/HomePost.vue";
import PostTypeOption from "@/views/home/PostTypeOption.vue";
import MindShare from "@/views/mind-share/MindShare.vue";
import {useAccountStore} from "@/stores/web3";
import {useChainStore} from "@/stores/chain";
import Predict from "@/views/predict/Index.vue";
import BasketsListView from '@/views/baskets/BasketsListView.vue'
import {TweetListType, useTweetsStore} from "@/stores/tweets";
import {filterByActiveChain} from "@/utils/chainFilter";
import {isBscBStockToken} from '@/config/bstocks'

const listType = ref(ListType.Trending)
const mindShareType = ref<MindShareType>(MindShareType.Project) // 1: project, 0: user
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const curationStore = useCurationStore();
const tweetsStore = useTweetsStore();
const refreshing = ref(false);
const loading = ref(false);
const router = useRouter();
const stateStore = useStateStore();
const chainStore = useChainStore();
const finished = reactive({
  [ListType.MarketCap]: false,
  [ListType.Trending]: false,
  [ListType.New]: false,
})
const { setInter } = useInterval()
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
const bStockCommunities = ref<Community[]>([])
const bStocksLoading = ref(false)
const bStocksLoaded = ref(false)

const isBStockCommunity = (community: Community) =>
  isBscBStockToken(community.token)

let newCommunitiesInterval: NodeJS.Timeout | null = null

watch(listType, (val) => {
  refresh()
})
watch(activeTab, (val) => {
  // 标签页切换时的处理
  console.log('Active tab changed to:', val)
})

async function refresh() {
  try{
    console.log('refresh')
    if (listType.value == ListType.MarketCap) {
      finished[ListType.MarketCap] = false
      let communities = await getCommunityByMarketCap() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.marketCapCommunities = communities
        getTokenInfo(communities).then((res) => {
          comStore.marketCapCommunities = [...res]
        })
      } else {
        finished[ListType.MarketCap] = true
      }
    } else if (listType.value == ListType.New) {
      finished[ListType.New] = false
      let communities = await getCommunitiesByNew() as Array<Community>;
      if (communities && communities.length > 0) {
        // comStore.newCommunities = communities
        getTokenInfo(communities).then((res) => {
          comStore.newCommunities = [...res]
        })
      } else {
        finished[ListType.New] = true
      }
    }else if(listType.value == ListType.Trending) {
      finished[ListType.Trending] = false
      let communities = await getCommunitiesByTrending() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = communities
        getTokenInfo(communities).then((res) => {
          comStore.trendingCommunities = [...res]
        })
      } else {
        finished[ListType.Trending] = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function loadMore() {
  try{
    loading.value = true
    if (listType.value == ListType.MarketCap) {
      if (finished[ListType.MarketCap]) return;
      if (!comStore.marketCapCommunities || comStore.marketCapCommunities.length == 0) {
        return;
      }
      let communities = await getCommunityByMarketCap(Math.floor((comStore.marketCapCommunities.length - 1) / 30) + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.marketCapCommunities = comStore.marketCapCommunities.concat(await getTokenInfo(communities))
      }
      if (communities.length < 30) {
        finished[ListType.MarketCap] = true
      }
    } else if (listType.value == ListType.New) {
      if (!comStore.newCommunities || comStore.newCommunities.length == 0) {
        return;
      }
      if (finished[ListType.New]) return;
      let communities = await getCommunitiesByNew(Math.floor((comStore.newCommunities.length - 1) / 30) + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = comStore.newCommunities.concat(await getTokenInfo(communities))
      }
      if (communities.length < 30) {
        finished[ListType.New] = true
      }
    }else if(listType.value == ListType.Trending) {
      if (!comStore.trendingCommunities || comStore.trendingCommunities.length == 0) {
        return;
      }
      if (finished[ListType.Trending]) return;
      let communities = await getCommunitiesByTrending(Math.floor((comStore.trendingCommunities.length - 1) / 30) + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = comStore.trendingCommunities.concat(await getTokenInfo(communities))
      }
      if (communities.length < 30) {
        finished[ListType.Trending] = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
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
  try{
    let communities = await getCommunitiesByNew() as Array<Community>;
    if (communities && communities.length > 0) {
      // 先用 API 数据填滚动条；只给可见的前 10 条做链上补价，减轻与 Feed 抢 RPC
      comStore.newCommunities = communities
      const head = communities.slice(0, 10)
      getTokenInfo(head).then((res) => {
        const byToken = new Map(res.map((c) => [c.token?.toLowerCase(), c]))
        comStore.newCommunities = communities.map((c) => byToken.get(c.token?.toLowerCase() ?? '') ?? c)
      })
    } else {
      finished[ListType.New] = true
    }
  } catch(e) {
    handleErrorTip(e)
  }
}

/** bStocks 按 BNB Chain 代币 CA 白名单分类，社区显示符号不参与判断。 */
async function loadBStocks(force = false) {
  if (bStocksLoading.value || (bStocksLoaded.value && !force)) return
  try {
    bStocksLoading.value = true
    const bStocks = filterByActiveChain((await getImportedCommunityInfo() || []) as Community[])
      .filter(isBStockCommunity)
    // 先展示 API 数据；链上补价失败时也不隐藏已识别的 bStocks。
    bStockCommunities.value = bStocks
    bStocksLoaded.value = true
    if (bStocks.length) {
      try {
        bStockCommunities.value = await getTokenInfo(bStocks)
      } catch (e) {
        console.error('Hydrate bStocks on-chain data failed:', e)
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    bStocksLoading.value = false
    refreshing.value = false
  }
}

async function refreshBStocks() {
  refreshing.value = true
  await loadBStocks(true)
}

/** 仅在 Coin 列表可见时拉数据，避免 Tag 首页抢 RPC */
function ensureCoinListLoaded() {
  if (activeMainMenu.value !== 'coin') return
  if (coinSubMenu.value === 'bStocks') {
    void loadBStocks()
    return
  }
  if (coinSubMenu.value !== 'tagCoin') return
  const list = currentCoinList.value
  if (!list || list.length === 0) {
    void refresh()
  }
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}

// 当前排序对应的列表（finished 文案据此判断，避免"加载完毕"被静默吞掉）
const currentCoinList = computed(() => {
  if (listType.value == ListType.MarketCap) return comStore.marketCapCommunities
  if (listType.value == ListType.New) return comStore.newCommunities
  return comStore.trendingCommunities
})

// 隐藏小市值（垃圾/测试币）：official / listed / 已导入 / 市值≥$4,200 的保留
const HIDE_DUST_KEY = 'hide-dust-coins'
const hideDust = ref(localStorage.getItem(HIDE_DUST_KEY) !== 'false')
watch(hideDust, (v) => localStorage.setItem(HIDE_DUST_KEY, String(v)))
function filterDust(list: Community[]) {
  if (!hideDust.value) return list
  return list.filter(c =>
    c.official || c.listed || c.isImport ||
    (parseFloat(c.marketCap as any) || 0) * stateStore.ethPrice >= 4200
  )
}

/** TagCoin 排除 CA 已识别为 bStocks 的导入社区。 */
function filterTagCoins(list: Community[]) {
  return filterDust(list).filter((community) => !isBStockCommunity(community))
}

// Coin 子 Tab 切换：状态 + URL query 双向同步（支持 ?tab=bstocks / ?tab=ip 深链）
const route = useRoute()
function switchCoinTab(tab: 'tagCoin' | 'baskets' | 'bStocks') {
  stateStore.setCoinSubMenu(tab)
  if (route.name === 'home') {
    router.replace({ query: tab === 'baskets' ? { tab: 'baskets' } : tab === 'bStocks' ? { tab: 'bstocks' } : {} })
  }
  ensureCoinListLoaded()
}


onMounted(async () => {
  // Tag 首页不立刻打 Coin 列表的 getTokenInfo；切到 Coin 再拉
  ensureCoinListLoaded()
  getSpaces();
  setInter(getSpaces, 20000);
  getNewCommunities();
  newCommunitiesInterval = setInterval(getNewCommunities, 60000);
  emitter.on('newCommunity', refresh);
})

watch([activeMainMenu, coinSubMenu], () => {
  ensureCoinListLoaded()
})

onActivated(() => {
  if(pageScrollRef.value)
  pageScrollTo(pageScrollRef.value)
})

onUnmounted(() => {
  if (newCommunitiesInterval) {
    clearInterval(newCommunitiesInterval)
  }
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
  if(!comStore.newCommunities) return []
  return comStore.newCommunities.slice(0, 10)
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
    
    <!-- Space 滚动条 - 仅在移动端显示，PC 端在右侧 Live Spaces 框中显示 -->
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
    
    <!-- Tag 菜单：Trending 和 New 按钮 -->
    <div v-if="activeMainMenu==='tag'" class="px-3 web:px-3 w-full web:max-w-[1240px] web:mx-auto flex gap-2 items-center">
      <div class="flex gap-2">
        <button 
          class="h-9 px-5 rounded-full text-h3 whitespace-nowrap transition-colors"
          :class="tweetsStore.homeTweetType === TweetListType.Trending ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="tweetsStore.homeTweetType = TweetListType.Trending"
        >
          {{ $t('trending') || 'Trending' }}
        </button>
        <button 
          class="h-9 px-5 rounded-full text-h3 whitespace-nowrap transition-colors"
          :class="tweetsStore.homeTweetType === TweetListType.New ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="tweetsStore.homeTweetType = TweetListType.New"
        >
          {{ $t('new') || 'New' }}
        </button>
      </div>
    </div>
    
    <!-- Home 菜单：TagCoin、Baskets、链对应的股票资产 -->
    <div v-if="activeMainMenu==='coin'" class="px-3 web:px-3 w-full web:max-w-[1240px] web:mx-auto flex gap-2 items-center justify-between">
      <div class="flex gap-2">
        <button
          class="h-9 px-2 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors"
          :class="coinSubMenu==='tagCoin' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('tagCoin')"
        >
          {{ $t('tagCoin') || 'TagCoin' }}
        </button>
        <button
          class="h-9 px-2 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors"
          :class="coinSubMenu==='baskets' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('baskets')"
        >
          {{ $t('baskets.menu') || 'Baskets' }}
        </button>
        <button
          class="h-9 px-2 web:px-5 text-h3 whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-1.5"
          :class="coinSubMenu==='bStocks' ? 'border-orange-normal text-orange-normal' : 'border-transparent text-black'"
          @click="switchCoinTab('bStocks')"
        >
          <img v-if="chainStore.deployment.key === 'rh'" src="~@/assets/icons/robinhood.png" class="h-5 w-auto object-contain" alt="Robinhood">
          {{ chainStore.deployment.key === 'rh' ? 'Stocks' : ($t('bStocks') || 'bStocks') }}
        </button>
      </div>
      <!-- 排序 + 隐藏小市值开关 -->
      <div class="flex-shrink-0 flex items-center gap-3">
        <label v-if="coinSubMenu==='tagCoin'" class="flex items-center gap-1.5 cursor-pointer text-sm text-grey-64 select-none" :title="$t('hideDust')">
          <el-switch v-model="hideDust" size="small" style="--el-switch-on-color: #FE913F" />
          <span class="hidden web:inline">{{ $t('hideDust') }}</span>
        </label>
        <el-select
          v-if="coinSubMenu==='tagCoin'"
          v-model="listType"
          class="bg-white rounded-full overflow-hidden max-w-[100px] c-select h-8 web:h-9 flex items-center text-xs web:text-sm text-black"
          popper-class="c-select-popper rounded-xl"
        >
          <el-option :value="ListType.MarketCap" :label="$t('marketCap')" />
          <el-option :value="ListType.Trending" :label="$t('trending')" />
          <el-option :value="ListType.New" :label="$t('new')" />
        </el-select>
      </div>
    </div>
    
    
    <HomePost v-if="activeMainMenu==='tag'"/>
    <template v-if="activeMainMenu==='coin' && coinSubMenu==='tagCoin'">
      <div class="flex-1 min-h-0 px-3 mobile-scroll-container no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <van-pull-refresh v-model="refreshing" @refresh="refresh"
                          class="min-h-full web:max-w-[1240px] web:mx-auto"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <van-list :loading="loading"
                    :finished="finished[listType]"
                    :immediate-check="false"
                    :loading-text="$t('loading')"
                    :finished-text="filterTagCoins(currentCoinList).length==0?'':$t('noMore')"
                    :offset="50"
                    @load="loadMore">

            <div v-if="filterTagCoins(comStore.trendingCommunities).length == 0 && !loading && listType == ListType.Trending"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.Trending"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(comStore.trendingCommunities)" :community :key="community.tick" @click="gotoDetail(community)" />
            </div>
            <div v-if="filterTagCoins(comStore.newCommunities).length == 0 && !loading && listType == ListType.New"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.New"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(comStore.newCommunities)" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
            </div>
            <div v-if="filterTagCoins(comStore.marketCapCommunities).length == 0 && !loading && listType == ListType.MarketCap"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.MarketCap"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of filterTagCoins(comStore.marketCapCommunities)" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
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
        <van-pull-refresh v-model="refreshing" @refresh="refreshBStocks"
                          class="min-h-full web:max-w-[1240px] web:mx-auto"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <div v-if="bStocksLoading && bStockCommunities.length === 0" class="flex justify-center py-10 w-full">
            <i-ep-loading class="animate-spin w-7 h-7 text-orange-normal" />
          </div>
          <div v-else-if="bStockCommunities.length === 0" class="flex justify-center py-6 w-full">
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
