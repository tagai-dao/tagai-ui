<script setup lang="ts">
import { withDefaults, defineProps } from 'vue'
import type {Tweet} from "@/types";

const props = withDefaults(
  defineProps<{post: Tweet|null}>(),
  {
    post: null,
  }
);
</script>

<template>
  <div class="bg-gradient-primary py-5 px-5 rounded-2xl flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <img class="w-6 h-6 rounded-full"
           src="~@/assets/icons/icon-default-avatar.svg" alt="">
      <span class="text-h5 text-grey-normal flex-1 truncate">Username</span>
      <button class="bg-white rounded-md h-5 px-2 text-sm">Host</button>
    </div>
    <div>
      <div class="text-h5">
        Make America Great again！
      </div>
      <div class="text-sm font-normal">
        Jun 6six 18:00 | 30 Min 30 Sec | 100 listeners
      </div>
    </div>
    <button class="text-h5 h-9 bg-black rounded-full text-white">
      Play recording
    </button>
  </div>
</template>

<style scoped>

</style>
