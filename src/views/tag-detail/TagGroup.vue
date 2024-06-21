<script setup lang="ts">

import MsgItem from "@/components/common/MsgItem.vue";
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col p-4">
    <div class="flex-1 overflow-auto no-scroll-bar flex flex-col gap-3">
      <MsgItem :msg-data="{content: 'test1', sendUserName: 'AAA', sendTime: new Date().getTime(), profileImg: ''}"/>
      <MsgItem :msg-data="{content: 'test2', sendUserName: 'AAA', sendTime: new Date().getTime(), profileImg: ''}"/>
      <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
      <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
      <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
    </div>
    <div class="h-10 px-4 rounded-full bg-gradient-primary w-full flex items-center gap-2 mt-2">
      <div class="flex">
        <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
          <img src="" alt="">
        </div>
        <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-20 -ml-2">
          <img src="" alt="">
        </div>
        <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 z-10 -ml-2">
          <img src="" alt="">
        </div>
      </div>
      <div class="text-white font-400 flex-1 truncate flex gap-2">
        <span class="font-bold">+220</span>
        <span class="truncate">Mint or buy to join the group</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
