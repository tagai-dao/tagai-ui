<template>
    <div>
        <div class="flex justify-between mb-2 overflow-x-auto no-scroll-bar">
            <div class="flex items-center justify-between gap-2 ">
            <button v-for="app in miniApps" class="text-h3 text-black h-8 rounded-full px-3 text-white whitespace-nowrap" 
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
import { getMiniApps } from '@/apis/api';
import { onMounted, ref } from 'vue';
import { useCommunityStore } from '@/stores/community';
import type { MiniApp } from '@/types';
import Empty from './Empty.vue';
import CommonTags from './CommonTags.vue';
import VoteTweets from './VoteTweets.vue';

const comStore = useCommunityStore()
const selectedApp = ref<MiniApp>()
const miniApps = ref<MiniApp[]>([]);
const componentId = ref<any>(Empty)

function choseApp(app: MiniApp) {
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
    const apps: any = await getMiniApps(comStore.currentSelectedCommunity!.tick)
    if (apps.length > 0) {
        choseApp(apps[0])
    }
    miniApps.value = apps;
    console.log('miniApps:', miniApps)
})
  </script>
  
  <style scoped>      
  
  </style>