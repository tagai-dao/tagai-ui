<script setup lang="ts">

import {TweetListType, useTweetsStore} from "@/stores/tweets";
const tweetsStore = useTweetsStore();


</script>

<template>
  <el-select
      v-model="tweetsStore.homeTweetType"
      class="bg-white rounded-full overflow-hidden max-w-[120px] c-select h-10 flex items-center text-h3 text-black"
      popper-class="c-select-popper rounded-xl"
  >
    <el-option :value="TweetListType.Trending" :label="$t('trending')" />
    <el-option :value="TweetListType.New" :label="$t('new')" />
  </el-select>
</template>

<style scoped>

</style>