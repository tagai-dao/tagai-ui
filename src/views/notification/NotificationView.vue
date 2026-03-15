<script setup lang="ts">
import { ref } from "vue";
import BackHeader from "@/layout/BackHeader.vue";
import TabSocial from "@/views/notification/TabSocial.vue";
import TabTips from "@/views/notification/TabTips.vue";

const activeTab = ref('social')
const tabOptions = [
  { key: 'social', label: 'notificationView.social' },
  { key: 'tips', label: 'notificationView.tips' }
]

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <!-- 移动端：显示返回头部，PC 端隐藏 -->
    <BackHeader class="px-3 web:hidden">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">{{$t('notificationView.notification')}}</div>
      </template>
    </BackHeader>
    <div class="flex justify-around items-center gap-2 bg-white h-12 min-h-12 px-4 rounded-2xl mx-3">
      <button v-for="tab of tabOptions" :key="tab.key"
              class="px-3 rounded-full h-8 text-h3 whitespace-nowrap"
              :class="tab.key===activeTab?'bg-orange-normal text-white':'text-grey-3f'"
              @click="activeTab=tab.key">{{$t(tab.label)}}</button>
    </div>
    <div class="flex-1 overflow-auto px-3">
      <TabSocial v-if="activeTab==='social'"/>
      <TabTips v-if="activeTab==='tips'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
