<template>
    <div class="flex justify-center items-center h-full">
      <img src="~@/assets/images/empty-data.svg" alt="">
    </div>
  </template>
  
  <script setup lang="ts">
import type { MiniApp } from '@/types';
import { onMounted, ref } from 'vue';
import { getCommunityTweetsWithTag } from '@/apis/api';
import { useAccountStore } from '@/stores/web3';

  const props = defineProps<{
    appData: MiniApp
  }>()

  const accStore = useAccountStore()

  onMounted(async () => {
    if (props.appData && props.appData.type === 1) {
      const res = await getCommunityTweetsWithTag(props.appData.tick, props.appData.tag, 0, accStore.getAccountInfo?.twitterId)
      console.log(432, res)
    }
  })
  </script>
  
  <style scoped>      
  
  </style>