<script setup lang="ts">
import {ref} from "vue";
import dayjs from "dayjs";

const props = defineProps({
  msgData: {
    type: Object,
    default: () => {
      return {
        content: 'Buy the dip!',
        sendUserName: 'AAA',
        sendTime: new Date().getTime(),
        profileImg: ''
      }
    }
  }
})
const userInfo = ref<{userName: string}>({
  userName: 'user'
})
</script>

<template>
  <div>
    <div class="flex items-end gap-4"
         :class="userInfo.userName===msgData.sendUserName?'flex-row-reverse':''">
      <div class="">
        <img class="min-w-9" v-if="msgData.profileImg" :src="msgData.profileImg" alt="">
        <div v-else class="bg-grey-light-hover h-9 w-9 min-w-9 rounded-full flex items-center justify-center">
          <i-ep-avatar/>
        </div>
        <div class="text-xs text-grey-8e text-center">{{userInfo.userName}}</div>
      </div>
      <div class="rounded-t-2xl p-2.5 min-h-9 break-all"
           :class="userInfo.userName===msgData.sendUserName?'rounded-bl-2xl bg-purple-c1':'rounded-br-2xl bg-grey-light-hover'">
        {{msgData.content}}
      </div>
    </div>
    <div class="text-xs text-grey-normal-hover text-center">{{dayjs(msgData.sendTime).format('HH:mm:ss')}}</div>
  </div>
</template>

<style scoped>

</style>
