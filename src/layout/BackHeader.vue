<script setup lang="ts">
import {usePageRouter} from "@/composables/useTools";

const {goBack} = usePageRouter()
</script>

<template>
  <div class="relative flex items-center justify-center h-14 py-1">
    <!-- bg-white 暗色由全局翻成 surface；箭头 SVG 描边为深色，暗色下 invert -->
    <button class="absolute top-1 left-3 h-12 w-12 min-w-12 bg-white rounded-full flex items-center justify-center"
            @click="goBack">
      <img class="dark:invert" src="~@/assets/icons/icon-back.svg" alt="">
    </button>
    <slot name="title"></slot>
    <slot name="right"/>
  </div>
</template>

<style scoped>

</style>
