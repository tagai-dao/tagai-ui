<script setup lang="ts">
import { type Community } from '@/types';
import { ref, computed } from 'vue'
import { useCurationStore } from '@/stores/curation';

const curationStore = useCurationStore()
const props = defineProps<{
  community: Community
}>()

const onlineSpace = computed(() => {
  const spaces = curationStore.allSpaces;
  return !!spaces.find(sp => sp.tick == props.community.tick)
})
</script>

<template>
  <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-5 px-3.5 flex gap-3">
    <div class="w-20 h-20 rounded-2xl bg-grey-normal-active shadow-tag-logo flex items-center justify-center
                relative overflow-hidden">
      <img class="w-15" :src="community.logo" alt="">
      <img v-show="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
    </div>
    <div class="flex-1">
      <div class="w-full flex justify-between">
        <div class="flex-1 truncate">
          <div class="flex gap-2 items-end">
            <span class="text-grey-normal text-h2 font-bold leading-6">{{ community.tick }}</span>
            <span class="font-normal italic text-grey-64 leading-6 text-sm">market cap</span>
            <span class="font-normal italic text-grey-64 leading-6 text-sm">88.23M</span>
          </div>
          <!-- <div class="text-grey-64 font-light text-sm">
            created by  @0XSarah
          </div> -->
          <div class="whitespace-pre-line text-grey-normal text-h5 mt-1">
            {{ community.description }}
          </div>
        </div>
        <slot name="default-btn">
          <div class="h-20 flex items-center">
            <button class="h-8 bg-gradient-primary text-white font-medium px-4 rounded-full">
              Trade
            </button>
          </div>
        </slot>
      </div>
      <div class="font-extralight flex flex-wrap gap-2 mt-2">
        <button class="bg-green-b6 px-2 h-5 text-xs rounded-md">{{ community.tick }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
