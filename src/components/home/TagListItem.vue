<script setup lang="ts">
import { type Community } from '@/types';
import { ref, computed } from 'vue'
import { useCurationStore } from '@/stores/curation';
import { formatPrice } from '@/utils/helper';
import { useAccountStore } from '@/stores/web3';
import { useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/community';
import { useStateStore } from '@/stores/common';
import {tagBgColors, tagTextColors} from "@/composables/useTags";
import IconLinks from "@/components/home/IconLinks.vue";

const curationStore = useCurationStore()
const accStore = useAccountStore()
const comStore = useCommunityStore()
const stateStore = useStateStore()
const router = useRouter()
const props = defineProps<{
  community: Community
}>()

const onlineSpace = computed(() => {
  const spaces = curationStore.allSpaces;
  return !!spaces.find(sp => sp.tick == props.community.tick)
})

async function trade() {
  comStore.currentSelectedCommunity = props.community
  router.push('/buy-sell/' + props.community.tick)
}
</script>

<template>
  <div class="bg-grey-fa border-[1px] border-white rounded-2xl py-5 px-3.5 flex gap-3">
    <div class="w-20 h-20 min-w-20 min-h-20 rounded-2xl bg-grey-normal-active shadow-tag-logo
                flex items-center justify-center relative overflow-hidden">
      <img class="w-full h-full object-center object-cover" :src="community.logo" alt="">
      <img v-show="onlineSpace" class="absolute -top-1 -left-1" src="~@/assets/icons/icon-audio.svg" alt="">
      <div v-if="community.listed" class="absolute bg-gradient-primary text-white font-bold px-6 text-sm
                  transform top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]">listed</div>
    </div>
    <div class="flex-1 flex flex-col justify-between truncate">
      <div class="flex gap-x-2 items-end flex-wrap">
        <span class="text-grey-normal text-h2 font-bold leading-6">{{ community.tick }}</span>
        <div class="flex-1 flex justify-end mt-1">
          <div v-if="community.marketCap" class="flex items-end gap-1">
            <span class="font-normal italic text-grey-64 leading-5 text-sm">market cap</span>
            <span class="font-medium italic text-orange-normal leading-5 text-sm">
              {{ formatPrice(parseFloat(community.marketCap as any) * stateStore.ethPrice) }}
            </span>
          </div>
        </div>
      </div>
      <div class="flex-1 w-full flex justify-between pt-1">
        <div class="flex-1 truncate">
          <div class="whitespace-pre-line text-grey-5a text-[14px] leading-[16px] font-medium multi-content multi-content-2">
            {{ community.description }}
          </div>
        </div>
        <slot name="default-btn">
          <div class="flex items-center">
            <button @click.stop="trade" class="h-8 bg-gradient-primary text-white font-medium px-4 rounded-full">
              Trade
            </button>
          </div>
        </slot>
      </div>
      <div v-if="community.tags" class="font-extralight flex flex-wrap gap-2 mt-2">
        <button v-for="(tag, index) of JSON.parse(community.tags as string)" :key="tag"
                class="px-2 h-5 text-xs rounded-md"
                :style="{backgroundColor: tagBgColors[index], color: tagTextColors[index]}">
          {{ tag }}
        </button>
      </div>

      <!-- <IconLinks class="my-1" :community="community"/> -->
    </div>
  </div>
</template>

<style scoped>

</style>
