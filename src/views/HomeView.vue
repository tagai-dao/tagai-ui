<script setup lang="ts">
import OnlineSpace from "@/components/common/OnlineSpace.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {computed, onActivated, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {type Community, GlobalModalType, ListType, MindShareType, PredictSortType, type Space} from '@/types'
import {getCommunitiesByNew, getCommunitiesByTrending, getCommunityByMarketCap, getOnlineSpaces} from "@/apis/api";
import {useCommunityStore} from "@/stores/community";
import {useCurationStore} from '@/stores/curation'
import {handleErrorTip} from '@/utils/notify'
import {useRouter} from "vue-router";
import {getTokenInfo} from '@/utils/pump'
import SearchBar from "@/components/common/SearchBar.vue";
import LanguageSwitcher from "@/components/common/LanguageSwitcher.vue";
import emitter from "@/utils/emitter";
import {useInterval, usePageScroll} from "@/composables/useTools";
import {formatPrice} from "../utils/helper";
import {useModalStore, useStateStore} from "@/stores/common";
import HomePost from "@/views/home/HomePost.vue";
import PostTypeOption from "@/views/home/PostTypeOption.vue";
import MindShare from "@/views/mind-share/MindShare.vue";
import {useAccountStore} from "@/stores/web3";
import Predict from "@/views/predict/Index.vue";
import IPList from "@/views/ip/IPList.vue";

const listType = ref(ListType.Trending)
const mindShareType = ref<MindShareType>(MindShareType.Project) // 1: project, 0: user
const predictSortType = ref<PredictSortType>(PredictSortType.All) // 0: all, 1: online, 2: ended
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const curationStore = useCurationStore();
const refreshing = ref(false);
const loading = ref(false);
const router = useRouter();
const stateStore = useStateStore();
const finished = reactive({
  [ListType.MarketCap]: false,
  [ListType.Trending]: false,
  [ListType.New]: false,
})
const { setInter } = useInterval()
const { pageScroll, pageScrollTo} = usePageScroll()
const pageScrollRef = ref()
const tabOptions = ['tweets', 'prediction', 'tagCoin', 'ip']
const activeTab = computed({
  get: () => stateStore.activeHomeTab,
  set: (val) => stateStore.setActiveHomeTab(val)
})

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
      let communities = await getCommunityByMarketCap((comStore.marketCapCommunities.length - 1) / 30 + 1) as Array<Community>;
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
      let communities = await getCommunitiesByNew((comStore.newCommunities.length - 1) / 30 + 1) as Array<Community>;
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
      let communities = await getCommunitiesByTrending((comStore.trendingCommunities.length - 1) / 30 + 1) as Array<Community>;
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
      getTokenInfo(communities).then((res) => {
        comStore.newCommunities = [...res]
      })
    } else {
      finished[ListType.New] = true
    }
  } catch(e) {
    handleErrorTip(e)
  }
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}


onMounted(async () => {
  refresh();
  getSpaces();
  setInter(getSpaces, 20000);
  getNewCommunities();
  newCommunitiesInterval = setInterval(getNewCommunities, 30000);
  emitter.on('newCommunity', refresh);
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
  const totalWidth = scrollNewCommunities.value.length * 120
  return (totalWidth / 120) * 1000
})

const newComContentWidth = computed(() => {
  return scrollNewCommunities.value.length * 120;
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
  <div class="h-full overflow-hidden pb-2 flex flex-col gap-3 pt-2">
    <div class="web:px-3">
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
    <div class="px-3 flex justify-between gap-2 web:gap-10" ref="scrollContainer">
      <!-- 移动端显示标签切换，PC 端隐藏（在左侧边栏显示） -->
      <div class="bg-white flex rounded-full overflow-hidden shadow-popper-tip web:hidden">
        <div v-for="tab of tabOptions" :key="tab"
             class="h-10 min-w-[80px] px-2 flex justify-center items-center text-h5 text-black rounded-full cursor-pointer"
             :class="activeTab===tab?'bg-gradient-primary text-white':''"
             @click="activeTab=tab">{{$t(tab)}}</div>
      </div>
      <SearchBar class="hidden web:flex"/>
      <!-- 语言切换按钮 - 移到原来 Trending 的位置 -->
      <LanguageSwitcher class="hidden web:flex" />
      <template v-if="activeTab==='mindshare'">
        <el-select
            v-model="mindShareType"
            class="bg-white rounded-full overflow-hidden max-w-[100px] c-select h-10 flex items-center text-h4 text-black"
            popper-class="c-select-popper rounded-xl"
        >
          <el-option :value="MindShareType.Project" :label="$t('mindShare.project')" />
          <el-option :value="MindShareType.User" :label="$t('mindShare.user')" />
        </el-select>
      </template>

    </div>
    
    <!-- Tweets 和 Prediction 按钮 - 仅在首页显示，放在 Search 框和内容之间 -->
    <div v-if="activeTab==='tweets' || activeTab==='prediction'" class="px-3 web:px-3 flex gap-2 items-center justify-between">
      <div class="w-1/4 web:w-1/3 max-w-[200px] flex gap-2">
        <button 
          class="flex-1 h-8 web:h-9 rounded-full text-xs web:text-sm font-medium transition-colors"
          :class="activeTab==='tweets' ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="stateStore.setActiveHomeTab('tweets')"
        >
          {{ $t('tweets') || 'Tweets' }}
        </button>
        <button 
          class="flex-1 h-8 web:h-9 rounded-full text-xs web:text-sm font-medium transition-colors"
          :class="activeTab==='prediction' ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="stateStore.setActiveHomeTab('prediction')"
        >
          {{ $t('prediction') || 'Prediction' }}
        </button>
      </div>
      <!-- Trending/New 选择器 - 显示在按钮同一行，靠右对齐（仅在 tweets 时显示） -->
      <div v-if="activeTab==='tweets'" class="flex-shrink-0">
        <PostTypeOption />
      </div>
      <!-- All/Online/Ended 选择器 - 显示在按钮同一行，靠右对齐（仅在 prediction 时显示） -->
      <div v-if="activeTab==='prediction'" class="flex-shrink-0">
        <el-select
          v-model="predictSortType"
          class="bg-white rounded-full overflow-hidden max-w-[100px] c-select h-8 web:h-9 flex items-center text-xs web:text-sm text-black"
          popper-class="c-select-popper rounded-xl"
        >
          <el-option :value="PredictSortType.All" :label="$t('all')" />
          <el-option :value="PredictSortType.Online" :label="$t('online')" />
          <el-option :value="PredictSortType.Ended" :label="$t('ended')" />
        </el-select>
      </div>
    </div>
    
    <!-- TagCoin 和 IPShare 按钮 - 仅在 Coin 标签页显示，放在 Search 框和内容之间 -->
    <div v-if="activeTab==='tagCoin' || activeTab==='ip'" class="px-3 web:px-3 flex gap-2 items-center justify-between">
      <div class="w-1/4 web:w-1/3 max-w-[200px] flex gap-2">
        <button 
          class="flex-1 h-8 web:h-9 rounded-full text-xs web:text-sm font-medium transition-colors"
          :class="activeTab==='tagCoin' ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="stateStore.setActiveHomeTab('tagCoin')"
        >
          {{ $t('tagCoin') || 'TagCoin' }}
        </button>
        <button 
          class="flex-1 h-8 web:h-9 rounded-full text-xs web:text-sm font-medium transition-colors"
          :class="activeTab==='ip' ? 'bg-gradient-primary text-white' : 'bg-white text-black hover:bg-gray-50'"
          @click="stateStore.setActiveHomeTab('ip')"
        >
          {{ $t('ip') || 'IPShare' }}
        </button>
      </div>
      <!-- Trending 切换按钮 - 移到右侧，与 TagCoin 内容区域右边对齐 -->
      <div class="flex-shrink-0">
        <el-select
          v-if="activeTab==='tagCoin'"
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
    
    <HomePost v-if="activeTab==='tweets'"/>
    <template v-if="activeTab==='tagCoin'">
      <div class="flex-1 px-3 overflow-auto no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <van-pull-refresh v-model="refreshing" @refresh="refresh"
                          class="min-h-full"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <van-list :loading="loading"
                    :finished="finished[listType]"
                    :immediate-check="false"
                    :finished-text="comStore.marketCapCommunities.length==0?'':$t('noMore')"
                    :offset="50"
                    @load="loadMore">

            <div v-if="comStore.trendingCommunities.length == 0 && !loading && listType == ListType.Trending"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.Trending"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of comStore.trendingCommunities" :community :key="community.tick" @click="gotoDetail(community)" />
            </div>
            <div v-if="comStore.newCommunities.length == 0 && !loading && listType == ListType.New"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.New"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of comStore.newCommunities" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
            </div>
            <div v-if="comStore.marketCapCommunities.length == 0 && !loading && listType == ListType.MarketCap"
                 class="flex justify-center py-6 w-full">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
            <div v-else v-show="listType == ListType.MarketCap"
                 class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
              <TagListItem v-for="community of comStore.marketCapCommunities" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
            </div>
          </van-list>
        </van-pull-refresh>
      </div>
    </template>
    <Predict :type="predictSortType" v-if="activeTab==='prediction'"/>
    <MindShare :mindShareType="mindShareType" v-if="activeTab==='mindshare'"/>
    <div class="flex-1 overflow-auto" v-if="activeTab==='ip'">
      <IPList />
    </div>
    
    <!-- 新社区列表 - 缩小到 1/5，放在底部 -->
    <div class="h-[14px] web:h-[16px] mt-auto web:px-3 pb-2 flex-shrink-0">
      <div class="w-full overflow-x-hidden whitespace-nowrap relative h-full">
        <div class="flex h-full" :class="newComNeedScroll?'scroll-content':''"
             :style="{ width: `${newComContentWidth}px`, animationDuration: `${newComDuration}ms`, animationDelay: '2s' }">
          <div class="w-[120px] min-w-[120px] flex justify-end h-full" @click="gotoDetail(community)"
               v-for="(community, index) in (newComNeedScroll?scrollNewCommunities.concat(scrollNewCommunities):scrollNewCommunities)"
               :key="index">
            <div class="h-full px-1.5 rounded-lg shadow-sm bg-white w-full max-w-[115px] flex items-center gap-1.5">
              <div class="flex-shrink-0">
                <div class="border-[1px] border-gray-200 rounded bg-gray-400 w-3 h-3 web:w-4 web:h-4 z-30">
                  <img class="w-full h-full rounded" :src="community.logo.startsWith('https://tiptag') ? community.logo + '?x-oss-process=image/resize,w_100' : community.logo" alt="">
                </div>
              </div>
              <div class="flex items-center gap-1 flex-1 min-w-0">
                <div class="text-[10px] web:text-xs font-bold leading-tight truncate" :class="community.listed ? 'text-orange-normal' : 'text-black'">{{community.tick}}</div>
                <span class="text-[10px] web:text-xs font-bold text-black">${{ formatPrice(Math.floor(parseFloat(community.marketCap as any) * stateStore.ethPrice)) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-red-normal w-[60px] h-[8px] web:w-[80px] web:h-[10px] flex justify-center items-center
                absolute top-[2px] left-[8px] transform -translate-x-1/2 -translate-y-1/2 -rotate-45
                whitespace-nowrap">
          <div class="blinking-text text-white text-[8px] web:text-[10px] font-bold">New</div>
        </div>
      </div>
    </div>
    
    <div>
      <button v-if="activeTab==='tagCoin'"
              class="absolute bottom-[80px] right-[10px] web:bottom-8"
              @click="onCreate(GlobalModalType.CreateCoin)">
        <img src="~@/assets/icons/icon-tabbar-create.svg" alt="">
      </button>
      <button v-else-if="activeTab==='tweets'"
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
