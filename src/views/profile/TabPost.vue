<script setup lang="ts">

import BannerTag from "@/components/common/BannerTag.vue";
</script>

<template>
  <div>
    <div>
      <div class="flex items-center gap-1 px-3">
        <span class="font-normal text-sm">创作 or Space 收入</span>
        <el-popover popper-class="c-popper">
          <template #reference>
            <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
          </template>
          <template #default>
            <div class="bg-white rounded-xl p-2 shadow-popper-tip">tips</div>
          </template>
        </el-popover>
      </div>
      <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar">
        <div class="snap-start shrink-0 first:pl-3 last:pr-4">
          <BannerTag/>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
