<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {ref} from "vue";
import TabIPShare from "@/views/notification/TabIPShare.vue";
import TabSocial from "@/views/notification/TabSocial.vue";
import TabTips from "@/views/notification/TabTips.vue";

const tabOptions = ['ipShare', 'social', 'tips']
const activeTab = ref('social')
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">{{$t('notificationView.notification')}}</div>
      </template>
    </BackHeader>
    <div v-if="false" class="flex justify-between items-center gap-2 px-3 bg-white rounded-2xl h-12 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('notificationView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto px-3">
      <TabIPShare v-if="activeTab==='ipShare'"/>
      <TabSocial v-if="activeTab==='social'"/>
      <TabTips v-if="activeTab==='tips'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
