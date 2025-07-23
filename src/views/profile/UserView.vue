<script setup lang="ts">
import {onMounted, ref} from "vue";
import TabBlink from "@/views/profile/TabBlink.vue";
import TabPost from "@/views/profile/TabPost.vue";
import TabCreateCoin from "@/views/profile/TabCreateCoin.vue";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";
import { getIpshareInfo } from '@/apis/api'
import { useInterval } from "@/composables/useTools";
import FarcasterBtn from "@/components/login/FarcasterBtn.vue";
import { useModalStore } from "@/stores/common";
import { GlobalModalType, type Account } from "@/types";
import { useRoute, useRouter } from "vue-router";
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'
import { getUserProfile } from '@/apis/api'
import TipTokenRecord from "@/views/wallet/TipTokenRecord.vue";

const accStore = useAccountStore()
const tabOptions = ['post', 'tipRecord']
const activeTab = ref('post')
const vp = ref(0)
const op = ref(0)
const userInfo = ref<Account | null>(null);
// const { profile, replaceEmptyProfile, gotoTwitter, vp, op, logout, updateBalance } = useAccount();
const { setInter } = useInterval()
const route = useRoute()
const router = useRouter()
const profileTableData = ref([
  { action: 'Curation', vp: 'Selected vp', op: 'Selected vp'},
  { action: 'Tweet', vp: '0', op: '200'},
  { action: 'Quote', vp: '0', op: '200'},
  { action: 'Reply', vp: '0', op: '50'},
  { action: 'Retweet', vp: '0', op: '5'},
  { action: 'Like', vp: '0', op: '3'},
])

const replaceEmptyProfile = (e: any) => {
    e.target.src = emptyProfile
}

const gotoTwitter = () => {
    window.open('https://x.com/' + userInfo.value?.twitterUsername, '__blank')
}

async function updateIPShare() {
  const acc = useAccountStore().getAccountInfo;
}

onMounted(async () => {
  const username = route.params.username as string
  if (!username) {
    router.replace('/')
    return;
  }
  
  // get user info
  const res = await getUserProfile(undefined, route.params.username as string)
  userInfo.value = res as Account
  console.log(1235, userInfo.value, route.params.username)
  // updateIPShare()
  // setInter(updateIPShare, 100000)
})

</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-3 rounded-2xl mx-3">
      <div class="flex gap-2 items-center">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             :src="userInfo?.profile" @error="replaceEmptyProfile" alt="">
        <div class="h-full flex-1">
          <div class="text-h3">{{ userInfo?.twitterName }}</div>
          <div class="flex items-center gap-1 leading-5">
            <span class="text-grey-8d">@{{ userInfo?.twitterUsername }}</span>
            <span class="mx-4px"> · </span>
            <button @click="gotoTwitter" >
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-2">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>{{ userInfo?.followings }} {{ $t('profileView.followings') }}</span>
          <span>{{ userInfo?.followers }} {{ $t('profileView.followers') }}</span>
        </div>
      </div>
    </div>
    <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div v-if="userInfo?.twitterId" class="flex-1 overflow-auto " id="profile-tab-scroller">
      <TabPost v-if="activeTab==='post'" :userInfo="userInfo"/>
      <TipTokenRecord v-if="activeTab==='tipRecord'" :userInfo="userInfo"/>
    </div>
  </div>
</template>

<style scoped>

</style>
