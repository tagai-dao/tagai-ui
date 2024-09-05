<script setup lang="ts">
import type {Community} from "@/types";

const props = defineProps<{
  community: Community|null
}>()

</script>

<template>
  <div class="h-4 flex ml-2 gap-2">
    <a v-if="community?.twitter" :href="community?.twitter ?? ''" target="_blank">
      <img class="w-4 min-w-4" src="~@/assets/icons/icon-link-x.svg" alt="">
    </a>
    <a v-if="community?.telegram" :href="community?.telegram ?? ''" target="_blank">
      <img class="w-4 min-w-4" src="~@/assets/icons/icon-link-tg.svg" alt="">
    </a>
    <a v-if="community?.official" :href="community?.official ?? ''" target="_blank">
      <img class="w-4 min-w-4" src="~@/assets/icons/icon-link-official.svg" alt="">
    </a>
  </div>
</template>

<style scoped>

</style>
