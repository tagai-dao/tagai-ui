<script setup lang="ts">
import type {Community} from "@/types";

const props = defineProps<{
  community: Community|null
}>()

</script>

<template>
  <div class="h-4 flex gap-1 pb-1">
    <a v-if="community?.twitter" href="#" target="_blank">
      <img class="w-3" src="~@/assets/icons/icon-link-x.svg" alt="">
    </a>
    <a v-if="community?.telegram" href="#" target="_blank">
      <img class="w-3" src="~@/assets/icons/icon-link-tg.svg" alt="">
    </a>
    <a v-if="community?.official" href="#" target="_blank">
      <img class="w-3" src="~@/assets/icons/icon-link-official.svg" alt="">
    </a>
  </div>
</template>

<style scoped>

</style>
