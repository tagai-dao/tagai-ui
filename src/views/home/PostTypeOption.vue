<script setup lang="ts">

import {TweetListType, useTweetsStore} from "@/stores/tweets";
const tweetsStore = useTweetsStore();


</script>

<template>
  <el-select
      v-model="tweetsStore.homeTweetType"
      class="bg-white rounded-full overflow-hidden max-w-[100px] c-select h-8 web:h-9 flex items-center text-xs web:text-sm text-black"
      popper-class="c-select-popper rounded-xl"
  >
    <el-option :value="TweetListType.Trending" :label="$t('trending')" />
    <el-option :value="TweetListType.New" :label="$t('new')" />
  </el-select>
</template>

<style scoped>

</style>