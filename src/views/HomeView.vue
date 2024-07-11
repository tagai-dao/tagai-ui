<script setup lang="ts">
import BannerTag from "@/components/common/BannerTag.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import { ref } from "vue";
import { ListType, type Community } from '@/types'
import { getCommunitiesByNew, getCommunitiesByTrending } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import { handleTransError } from '@/utils/notify'

const listType = ref(ListType.Trending)
const typePopoverVisible = ref(false)
const comStore = useCommunityStore();
const refreshing = ref(false);
const loading = ref(false);

async function refresh() {
  try{
    if (refreshing.value) return;
    refreshing.value = true
    if (listType.value == ListType.New) {
      let communities = await getCommunitiesByNew() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.newCommunities = communities
      }
    }else if(listType.value == ListType.Trending) {
      let communities = await getCommunitiesByTrending() as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = communities
      }
    }
  } catch (e) {
    handleTransError(e)
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
        comStore.newCommunities = comStore.newCommunities.concat(communities)
      }
    }else if(listType.value == ListType.Trending) {
      if (!comStore.trendingCommunities || comStore.trendingCommunities.length == 0) {
        return;
      }
      let communities = await getCommunitiesByTrending((comStore.trendingCommunities.length - 1) / 30 + 1) as Array<Community>;
      if (communities && communities.length > 0) {
        comStore.trendingCommunities = comStore.trendingCommunities.concat(communities)
      }
    }
  } catch (e) {
    handleTransError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar">
      <div class="snap-start shrink-0 first:pl-3">
        <BannerTag />
      </div>
      <div class="snap-start shrink-0 first:pl-3 last:pr-4">
        <BannerTag />
      </div>
    </div>
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
      <div class="flex flex-col gap-y-2">
        <TagListItem v-for="i of 10" :key="i" @click="$router.push(`/tag-detail/${i}`)" />
      </div>
    </div>
  </div>
</template>
