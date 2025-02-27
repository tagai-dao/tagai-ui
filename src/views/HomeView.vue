<script setup lang="ts">
import OnlineSpace from "@/components/common/OnlineSpace.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {ref, onActivated, onMounted, watch, computed} from "vue";
import { ListType, type Community, type Space } from '@/types'
import { getCommunitiesByNew, getCommunitiesByTrending, getOnlineSpaces } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import { useCurationStore } from '@/stores/curation'
import { handleErrorTip } from '@/utils/notify'
import { useRouter } from "vue-router";
import { getTokenInfo } from '@/utils/pump'
import SearchBar from "@/components/common/SearchBar.vue";
import emitter from "@/utils/emitter";
import {useInterval, usePageScroll} from "@/composables/useTools";
import ClankerList from "./clanker/ClankerList.vue";

const listType = ref(ListType.Trending)
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const curationStore = useCurationStore();
const refreshing = ref(false);
const loading = ref(false);
const router = useRouter();
const finished = ref(false)
const { setInter } = useInterval()
const { pageScroll, pageScrollTo} = usePageScroll()
const pageScrollRef = ref()
const tabOptions = ['Base', 'BSC', 'NULS', 'ENULS']
const activeTab = ref('Base')

watch(listType, (val) => {
  refresh()
})

watch(activeTab, (val) => {
  gotoChain(val)
})

async function refresh() {
  try{
    finished.value = false
    if (listType.value == ListType.New) {
      let communities = await getCommunitiesByNew() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = await getTokenInfo(communities)
      } else {
        finished.value = true
      }
    }else if(listType.value == ListType.Trending) {
      let communities = await getCommunitiesByTrending() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = await getTokenInfo(communities)
      } else {
        finished.value = true
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
    if (finished.value) return;
    loading.value = true
    if (listType.value == ListType.New) {
      if (!comStore.newCommunities || comStore.newCommunities.length == 0) {
        return;
      }
      let communities = await getCommunitiesByNew((comStore.newCommunities.length - 1) / 30 + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = comStore.newCommunities.concat(await getTokenInfo(communities))
      } else {
        finished.value = true
      }
    }else if(listType.value == ListType.Trending) {
      if (!comStore.trendingCommunities || comStore.trendingCommunities.length == 0) {
        return;
      }
      let communities = await getCommunitiesByTrending((comStore.trendingCommunities.length - 1) / 30 + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = comStore.trendingCommunities.concat(await getTokenInfo(communities))
      } else {
        finished.value = true
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
      curationStore.allSpaces = spaces
    }else {
      curationStore.allSpaces = [];
    }
  } catch(e) {
    // handleErrorTip(e)
  }
}

function gotoChain(chain: string){
  if (chain === 'ENULS') {
    window.open('https://enuls.tiptag.social', '__blank')
    return;
  } else if (chain === 'BSC') {
    window.open('https://tagai.fun', '__blank')
    return;
  } else if (chain === 'NULS') {
    window.open('https://nuls.tagai.fun', '__blank')
    return;
  }
  activeTab.value = 'Base'
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}


onMounted(async () => {
  refresh();
  getSpaces();
  setInter(getSpaces, 10000);
  emitter.on('newCommunity', refresh);
})

onActivated(() => {
  pageScrollTo(pageScrollRef.value)
})

const duration = computed(() => {
  const totalWidth = curationStore.allSpaces.length * 320
  return (totalWidth / 80) * 1000
})

const contentWidth = computed(() => {
  return curationStore.allSpaces.length * 320;
})
</script>

<template>
  <div class="h-full overflow-hidden pb-2 flex flex-col gap-3">
   <!-- <van-swipe :loop="false" :width="320" :autoplay="3000" :show-indicators="false" class="px-3">
     <van-swipe-item v-for="space of curationStore.allSpaces">
       <OnlineSpace @click="$router.push('/space-detail/' + space.tweetId)" :space/>
     </van-swipe-item>
   </van-swipe> -->
    <div class="w-full overflow-x-hidden whitespace-nowrap relative" ref="container">
      <OnlineSpace class="ml-4" v-if=" curationStore.allSpaces.length == 1" @click="$router.push('/space-detail/' +  curationStore.allSpaces[0].tweetId)" :space=" curationStore.allSpaces[0]"/>
      <div v-else class="scroll-content flex"
           :style="{ width: `${contentWidth}px`, animationDuration: `${duration}ms`, animationDelay: '2s' }">
        <div class="w-[320px] min-w-[320px] flex justify-end"
             v-for="(space, index) in curationStore.allSpaces.concat(curationStore.allSpaces)"
             :key="index">
          <OnlineSpace @click="$router.push('/space-detail/' + space.tweetId)" :space/>
        </div>
      </div>
    </div>
    <div class="px-3 flex justify-between gap-4 web:gap-10">
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
        <el-option :value="ListType.Trending" label="Trending" />
        <el-option :value="ListType.New" label="New" />
      </el-select>
    </div>
    <div class="flex-1 px-3 overflow-auto" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
      <van-pull-refresh v-show="activeTab == 'Base'" v-model="refreshing" @refresh="refresh"
                        class="min-h-full"
                        loading-text="Loading"
                        pulling-text="Pull to refresh data"
                        loosing-text="Release to refresh">
        <van-list :loading="loading"
                  :finished="finished"
                  :immediate-check="false"
                  finished-text="No more"
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
          <div v-if="comStore.trendingCommunities.length == 0 && !loading && listType == ListType.New"
                  class="flex justify-center py-6 w-full">
                  <img src="~@/assets/images/empty-data.svg" alt="">
                </div>
          <div v-else v-show="listType == ListType.New"
               class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
            <TagListItem v-for="community of comStore.newCommunities" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
          </div>
        </van-list>
      </van-pull-refresh>

      <ClankerList v-show="activeTab == 'Clanker'" :listType/>
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
</style>
