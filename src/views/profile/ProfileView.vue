<script setup lang="ts">
import {ref} from "vue";
import TabHoldCoin from "@/views/profile/TabHoldCoin.vue";
import TabPost from "@/views/profile/TabPost.vue";

const tabOptions = ['holdCoin', 'post', 'createCoin']
const activeTab = ref('post')
</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-4 rounded-2xl mx-3">
      <div class="flex gap-4 items-center">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="h-full flex-1">
          <div class="text-h3">Username</div>
          <div class="flex items-center gap-1 leading-5">
            <span class="text-grey-8d">@asmonmy</span>
            <span class="mx-4px"> · </span>
            <button>
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
        <div class="w-[90px] flex flex-col items-center gap-1">
          <div class="w-full flex justify-between text-sm px-1 text-grey-normal">
            <span>80%</span>
            <span>VP</span>
          </div>
          <el-progress :percentage="80" :stroke-width="8" :show-text="false"
                       class="c-gradient-progress c-gradient-progress-purple w-full"/>
        </div>
      </div>
      <div class="pl-14 flex items-center gap-4 mt-2">
        <span>28 正在关注</span>
        <span>28 关注者</span>
      </div>
    </div>
    <div class="flex justify-between gap-2 px-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto px-3" id="profile-tab-scroller">
      <TabHoldCoin v-if="activeTab==='holdCoin'"/>
      <TabPost v-if="activeTab==='post'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
