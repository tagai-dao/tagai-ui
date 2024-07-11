<script setup lang="ts">
import BannerTag from "@/components/common/BannerTag.vue";
import TagListItem from "@/components/home/TagListItem.vue";
import {ref} from "vue";
import { ListType } from '@/types'
import { getCommunitiesByNew, getCommunitiesByTrending } from "@/apis/api";

const listType = ref(ListType.Trending)
const typePopoverVisible = ref(false)

async function refresh() {

}

async function loadMore() {

}
</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar">
      <div class="snap-start shrink-0 first:pl-3 ">
        <BannerTag/>
      </div>
      <div class="snap-start shrink-0 first:pl-3 last:pr-4">
        <BannerTag/>
      </div>
    </div>
    <div class="px-3 flex justify-end">
      <el-select v-model="listType"
                 class="bg-white rounded-full overflow-hidden max-w-[120px] c-select h-10 flex items-center
                        text-h3 text-black"
                 popper-class="c-select-popper rounded-xl">
        <el-option :value="ListType.Trending" label="Trending"/>
        <el-option :value="ListType.New" label="New"/>
      </el-select>
    </div>
    <div class="flex-1 px-3 overflow-auto">
      <div class="flex flex-col gap-y-2">
        <TagListItem v-for="i of 10" :key="i" @click="$router.push(`/tag-detail/${i}`)"/>
      </div>
    </div>
  </div>
</template>
