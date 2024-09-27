<script setup lang="ts">
import {usePageRouter} from "@/composables/useTools";

const {goBack} = usePageRouter()
</script>

<template>
  <div class="relative flex items-center justify-center h-14 py-1">
    <button class="absolute top-1 left-3 h-12 w-12 min-w-12 bg-white rounded-full flex items-center justify-center"
            @click="goBack">
      <img src="~@/assets/icons/icon-back.svg" alt="">
    </button>
    <slot name="title"></slot>
    <slot name="right"/>
  </div>
</template>

<style scoped>

</style>
