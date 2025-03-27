<script setup lang="ts">
import OnlineSpace from "@/components/common/OnlineSpace.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {ref, onActivated, onMounted, watch, computed, reactive, onUnmounted} from "vue";
import { ListType, type Community, type Space } from '@/types'
import { getCommunitiesByNew, getCommunitiesByTrending, getCommunityByMarketCap, getOnlineSpaces } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import { useCurationStore } from '@/stores/curation'
import { handleErrorTip } from '@/utils/notify'
import { useRouter } from "vue-router";
import { getTokenInfo } from '@/utils/pump'
import SearchBar from "@/components/common/SearchBar.vue";
import emitter from "@/utils/emitter";
import {useInterval, usePageScroll} from "@/composables/useTools";
import { formatPrice } from "../utils/helper";
import { useStateStore } from "@/stores/common";

const listType = ref(ListType.MarketCap)
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const curationStore = useCurationStore();
const refreshing = ref(false);
const loading = ref(false);
const router = useRouter();
const finished = reactive({
  [ListType.MarketCap]: false,
  [ListType.Trending]: false,
  [ListType.New]: false,
})
const { setInter } = useInterval()
const { pageScroll, pageScrollTo} = usePageScroll()
const pageScrollRef = ref()
const tabOptions = ['BSC', 'NULS']
const activeTab = ref('BSC')

let newCommunitiesInterval: NodeJS.Timeout | null = null

watch(listType, (val) => {
  refresh()
})
watch(activeTab, (val) => {
  gotoChain(val)
})

async function refresh() {
  try{
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
function gotoChain(chain: string){
  if (chain === 'ENULS') {
    window.open('https://enuls.tagai.fun', '__blank')
  } else if (chain === 'Base') {
    window.open('https://base.tagai.fun', '__blank')
  } else if (chain === 'NULS') {
    window.open('https://nuls.tagai.fun', '__blank')
  } else if (chain === 'Solana') {
    window.open('https://sol.tagai.fun', '__blank')
  }
  activeTab.value = 'BSC'
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

const stateStore = useStateStore()
const scrollNewCommunities = computed(() => {
  if(!comStore.newCommunities) return []
  return comStore.newCommunities.slice(0, 10)
})

const newComDuration = computed(() => {
  const totalWidth = scrollNewCommunities.value.length * 210
  return (totalWidth / 120) * 1000
})

const newComContentWidth = computed(() => {
  return scrollNewCommunities.value.length * 210;
})

const newComNeedScroll = ref(true)
watch([() => newComContentWidth.value, () => scrollContainer.value], () => {
  if(!scrollContainer.value) return
  newComNeedScroll.value = newComContentWidth.value>scrollContainer.value.clientWidth
})
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
      <div class="mt-3 flex">
        <div class="w-full overflow-x-hidden whitespace-nowrap relative" >
          <div class="flex" :class="newComNeedScroll?'scroll-content':''"
               :style="{ width: `${newComContentWidth}px`, animationDuration: `${newComDuration}ms`, animationDelay: '2s' }">
            <div class="w-[210px] min-w-[210px] flex justify-end" @click="gotoDetail(community)"
                 v-for="(community, index) in (newComNeedScroll?scrollNewCommunities.concat(scrollNewCommunities):scrollNewCommunities)"
                 :key="index">
              <div class="h-[60px] px-2 rounded-xl shadow-sm bg-white w-full max-w-[200px] flex items-center gap-2">
                <div class="flex">
                  <div class="border-[1px] border-white rounded-lg bg-gray-400 w-[40px] h-[40px] z-30">
                    <img class="w-full h-full rounded-lg" :src="community.logo.startsWith('https://tiptag') ? community.logo + '?x-oss-process=image/resize,w_100' : community.logo" alt="">
                  </div>
                </div>
                <div class="flex flex-col">
                  <div class="flex-1 multi-content multi-content-2 text-sm font-bold leading-4 " :class="community.listed ? 'text-orange-normal' : ''">{{community.tick}}</div>
                  <div class="font-400 flex flex-nowrap text-sm">
                    <span class="">{{$t('marketCap')}}</span>
                    <span class="mx-1">·</span>
                    <span class="font-bold">{{ formatPrice(Math.floor(parseFloat(community.marketCap as any) * stateStore.ethPrice)) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-red-normal w-[100px] h-[14px] flex justify-center items-center
                  absolute top-[15px] left-[15px] transform -translate-x-1/2 -translate-y-1/2 -rotate-45
                  whitespace-nowrap">
            <div class="blinking-text text-white text-sm font-bold">New</div>
          </div>
        </div>
      </div>
    </div>
    <div class="px-3 flex justify-between gap-4 web:gap-10" ref="scrollContainer">
      <el-select
          v-model="activeTab"
          class="bg-white rounded-full overflow-hidden max-w-[200px] c-select h-10 flex items-center text-h3 text-black"
          popper-class="c-select-popper rounded-xl"
      >
        <el-option v-for="tab of tabOptions" :key="tab" :value="tab" :label="tab" />
      </el-select>
      <SearchBar class="hidden web:flex"/>
      <el-select
        v-model="listType"
        class="bg-white rounded-full overflow-hidden max-w-[200px] c-select h-10 flex items-center text-h3 text-black"
        popper-class="c-select-popper rounded-xl"
      >
        <el-option :value="ListType.MarketCap" :label="$t('marketCap')" />
        <el-option :value="ListType.Trending" :label="$t('trending')" />
        <el-option :value="ListType.New" :label="$t('new')" />
      </el-select>
    </div>
    <div class="flex-1 px-3 overflow-auto no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
      <van-pull-refresh v-show="activeTab == 'BSC'" v-model="refreshing" @refresh="refresh"
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
