<script setup lang="ts">
import { ref } from 'vue';
import TagCredit from './TagCredit.vue';
import PredictionCredit from './PredictionCredit.vue';
import i18n from '@/lang';

const t = i18n.global.t;
const activeTab = ref('communityCredit');

const tabs = [
  'communityCredit',
  'predictionCredit'
];
</script>

<template>
  <div class="flex flex-col gap-2 h-full">
    <div class="flex items-center justify-start gap-2 ">
      <button v-for="(tab, index) in tabs" :key="index" class="text-h3 text-black h-8 rounded-full px-3 text-white" 
        :class="(activeTab == tab) ? 'bg-gradient-primary' : 'bg-grey-light-active'"
        @click="activeTab = tab">
        {{ $t('community.' + tab) }}
      </button>
    </div>
    
    <div class="flex-1 overflow-hidden"> 
       <TagCredit v-if="activeTab === 'communityCredit'" />
       <PredictionCredit v-if="activeTab === 'predictionCredit'" />
    </div>
  </div>
</template>
