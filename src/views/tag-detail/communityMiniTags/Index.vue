<template>
    <div>
        <div class="flex justify-between mb-2 overflow-x-auto no-scroll-bar">
            <div class="flex items-center justify-between gap-2 ">
            <button v-for="app in communityMiniTags" class="text-h3 text-black h-8 rounded-full px-3 text-white whitespace-nowrap" 
                :class="(selectedApp?.id === app.id) ? 'bg-gradient-primary' : 'bg-grey-light-active'"
                :key="app.id"
                @click="choseApp(app)">
                {{ app.name }}
            </button>
            </div>
        </div>
        <component :is="componentId" :app-data="selectedApp" :key="selectedApp?.id">

        </component>
    </div>
</template>

<script setup lang="ts">
import { getCommunityMiniTags } from '@/apis/api';
import { onMounted, ref } from 'vue';
import { useCommunityStore } from '@/stores/community';
import type { CommunityMiniTag } from '@/types';
import Empty from './Empty.vue';
import CommonTags from './CommonTags.vue';
import VoteTweets from './VoteTweets.vue';

const comStore = useCommunityStore()
const selectedApp = ref<CommunityMiniTag>()
const communityMiniTags = ref<CommunityMiniTag[]>([]);
const componentId = ref<any>(Empty)

function choseApp(app: CommunityMiniTag) {
    selectedApp.value = app;
    switch(app.type) {
        case 1:
            componentId.value = CommonTags
            break;
        case 2:
            componentId.value = VoteTweets
            break;
        default:
            componentId.value = Empty
    }
}

onMounted(async () => {
    const apps: any = await getCommunityMiniTags(comStore.currentSelectedCommunity!.tick)
    if (apps.length > 0) {
        choseApp(apps[0])
    }
    communityMiniTags.value = apps;
    console.log('communityMiniTags:', communityMiniTags)
})
  </script>
  
  <style scoped>      
  
  </style>
