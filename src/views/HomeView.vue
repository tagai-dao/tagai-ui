<script setup lang="ts">
import BannerTag from "@/components/common/BannerTag.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import { ref, onActivated, onMounted, watch } from "vue";
import { ListType, type Community, type Space } from '@/types'
import { getCommunitiesByNew, getCommunitiesByTrending, getOnlineSpaces } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import { useCurationStore } from '@/stores/curation'
import { handleErrorTip } from '@/utils/notify'
import { useRouter } from "vue-router";
import { getTokenCap } from '@/utils/pump'

const listType = ref(ListType.Trending)
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const curationStore = useCurationStore();
const refreshing = ref(false);
const loading = ref(false);
const router = useRouter();
const finished = ref(false)

watch(listType, (val) => {
  refresh()
})

async function refresh() {
  try{
    if (refreshing.value) return;
    refreshing.value = true
    if (listType.value == ListType.New) {
      let communities = await getCommunitiesByNew() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = await getTokenCap(communities)
      }
    }else if(listType.value == ListType.Trending) {
      let communities = await getCommunitiesByTrending() as Array<Community>;
      if (communities && communities.length > 0) {
        getTokenCap(communities);
        comStore.trendingCommunities = await getTokenCap(communities)
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
    if (refreshing.value || loading.value) return;
    loading.value = true
    if (listType.value == ListType.New) {
      if (!comStore.newCommunities || comStore.newCommunities.length == 0) {
        return;
      }
      let communities = await getCommunitiesByNew((comStore.newCommunities.length - 1) / 30 + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = comStore.newCommunities.concat(await getTokenCap(communities))
      }
    }else if(listType.value == ListType.Trending) {
      if (!comStore.trendingCommunities || comStore.trendingCommunities.length == 0) {
        return;
      }
      let communities = await getCommunitiesByTrending((comStore.trendingCommunities.length - 1) / 30 + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = comStore.trendingCommunities.concat(await getTokenCap(communities))
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
    if (spaces && spaces.length === 0) {
      curationStore.allSpaces = spaces;
    }else {
      curationStore.allSpaces = [];
    }
  } catch(e) {
    handleErrorTip(e)
  }
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}

onActivated(async () => {
  getSpaces()
})

onMounted(async () => {
  refresh();
})
</script>

<template>
  <div class="h-full overflow-hidden pb-2 flex flex-col gap-3">
    <van-swipe :loop="true" :width="320" :autoplay="3000" :show-indicators="false" class="px-3">
      <van-swipe-item v-for="space of curationStore.allSpaces">
        <BannerTag :space/>
      </van-swipe-item>
    </van-swipe>
    <div class="px-3 flex justify-end">
      <el-select
        v-model="listType"
        class="bg-white rounded-full overflow-hidden max-w-[120px] c-select h-10 flex items-center text-h3 text-black"
        popper-class="c-select-popper rounded-xl"
      >
        <el-option :value="ListType.Trending" label="Trending" />
        <el-option :value="ListType.New" label="New" />
      </el-select>
    </div>
    <div class="flex-1 px-3 overflow-auto">
      <van-pull-refresh v-model="refreshing" @refresh="refresh"
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
          <div v-show="listType == ListType.Trending" class="flex flex-col gap-y-2">
            <div v-if="comStore.trendingCommunities.length == 0" class="flex items-center justify-center">
              no data
            </div>
            <TagListItem v-else v-for="community of comStore.trendingCommunities" :community :key="community.tick" @click="gotoDetail(community)" />
          </div>
          <div v-show="listType == ListType.New" class="flex flex-col gap-y-2">
            <div v-if="comStore.newCommunities.length == 0" class="flex items-center justify-center">
            no data
            </div>
            <TagListItem v-else v-for="community of comStore.newCommunities" :community :key="community.tick + '-2'" @click="gotoDetail(community)" />
          </div>
        </van-list>
      </van-pull-refresh>

    </div>
  </div>
</template>

<style lang="scss">

</style>
