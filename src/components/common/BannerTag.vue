<script setup lang="ts">
import { type Space } from '@/types';
const props = defineProps<{
  space: Space
}>();
</script>

<template>
  <div class="h-10 px-4 rounded-full bg-gradient-primary w-full max-w-[300px] flex items-center gap-2">
    <div class="flex">
      <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
        <img src="" alt="">
      </div>
      <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-20 -ml-2">
        <img src="" alt="">
      </div>
      <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 z-10 -ml-2">
        <img src="" alt="">
      </div>
    </div>
    <div class="text-white font-400 flex-1 truncate">
      <span class="font-bold">+220</span>
      <span class="mx-1">·</span>
      <span class="truncate">Biden stand</span>
    </div>
    <img src="~@/assets/icons/icon-playing.svg" alt="">
  </div>
</template>

<style scoped>

</style>
