<script setup lang="ts">
import { type Space } from '@/types';
const props = defineProps<{
  space: Space
}>();
</script>

<template>
  <div class="h-11 pl-2 pr-4 rounded-full bg-gradient-primary w-full max-w-[300px] flex items-center gap-2">
    <div class="flex">
      <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
        <img class="w-full h-full rounded-full" :src="space.logo" alt="">
      </div>
    </div>
    <div class="flex-1 multi-content multi-content-2 text-xs leading-4 text-white">{{ space.title }}</div>
    <div class="text-white font-400 flex flex-nowrap">
      <span class="font-bold">+{{ space.participantCount ?? 0 }}</span>
      <span class="mx-1">·</span>
      <img src="~@/assets/icons/icon-playing.svg" alt="">
    </div>
  </div>
</template>

<style scoped>

</style>
