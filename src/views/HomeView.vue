<script setup lang="ts">

import BannerTag from "@/components/common/BannerTag.vue";
import TagListItem from "@/components/home/TagListItem.vue";
</script>

<template>
  <div class="h-full overflow-auto py-2">
    <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar">
      <div class="snap-start shrink-0 first:pl-3 ">
        <BannerTag/>
      </div>
      <div class="snap-start shrink-0 first:pl-3 last:pr-4">
        <BannerTag/>
      </div>
    </div>
    <div class="px-3 mt-3">
      <div class="flex flex-col gap-y-2">
        <TagListItem v-for="i of 10" :key="i"/>
      </div>
    </div>
  </div>
</template>
