<script setup lang="ts">
import type { Tweet, CurateRecord } from "@/types";
import {onMounted, ref} from "vue";
import { getTweetCurateList } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { formatAmount, parseTimestamp } from "@/utils/helper";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const curateList = ref<CurateRecord[]>([])

const props = defineProps<{tweet: Tweet}>()

const onLoad = async () => {
  if (finished.value || curateList.value.length == 0 || loading.value) return;
  loading.value = true
  try{
    if (props.tweet.tweetId) {
      const list: any = await getTweetCurateList(props.tweet.tweetId, Math.floor((curateList.value.length - 1) / 30) + 1)
      curateList.value = curateList.value.concat(list)
      if (list.length < 30) {
        finished.value = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}
const onRefresh = async () => {
  try{
    finished.value = false
    if (props.tweet.tweetId) {
      const list: any = await getTweetCurateList(props.tweet.tweetId)
      curateList.value = list
      if (list.length < 30) {
        finished.value = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  onRefresh()
})
</script>

<template>
  <div class="max-h-[80vh] overflow-auto no-scroll-bar">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :offset="50"
                @load="onLoad">
        <div v-for="(curate, i) of curateList" :key="i"
             class="bg-white rounded-2xl py-3 px-3.5 flex items-stretch gap-3 mb-2">
          <div class="py-2">
            <!--            like-->
            <!-- <img v-if="(curate.curateRecord & 1) == 1" src="~@/assets/icons/icon-like-active.svg" alt=""> -->
            <!--            retweet-->
            <!-- <img v-if="(curate.curateRecord & 2) == 2" class="mt-2" src="~@/assets/icons/btn-retweet-active.svg" alt=""> -->
            <!--            reply-->
            <!--            <img src="~@/assets/icons/btn-reply-active.svg" alt="">-->
            <!--            quote-->
            <!--            <img src="~@/assets/icons/btn-quote-active.svg" alt="">-->
          </div>
          <div class="flex-1 items-center flex">
            <div class="flex items-center gap-2">
              
            <UserAvatar
              :profile-img="curate.profile"
              :name="curate.twitterName"
              :username="curate.twitterUsername"
              :followers="curate.followers"
              :followings="curate.followings"
              :eth-addr="curate.ethAddr"
              :credit="curate.credit"
              :steem-id="''"
              :credit-factor="curate.creditFactor"
          :teleported="true"
        >
          <template #avatar-img>
            <img
              v-if="curate.profile"
              class="w-7 h-7 min-w-7 min-h-7 rounded-full cursor-pointer bg-color2A"
              :src="curate.profile"
              alt=""
            />
            <img
              v-else
              class="w-7 h-7 min-w-7 min-h-7 rounded-full cursor-pointer bg-color2A"
              src="~@/assets/icons/icon-default-avatar.svg"
              alt=""
            />
          </template>
            </UserAvatar>
              <span class="text-grey-8d font-normal">@{{ curate.twitterUsername }}</span>
            </div>
            <!-- <span class="text-grey-normal text-h5">Username</span> -->
          </div>
          <div class="flex flex-row items-center">
            <img v-if="curate.replyVp && curate.replyVp > 0" src="~@/assets/icons/vp3.gif" alt="" class="w-5 h-7">
            <img v-if="curate.curationVp && curate.curationVp >= 5" src="~@/assets/icons/vp5.gif" alt="" class="w-6 h-6">
            <img v-if="curate.curationVp && curate.curationVp == 10" src="~@/assets/icons/vp5.gif" alt="" class="w-6 h-6">
            <img v-if="curate.curationVp && curate.curationVp % 5 > 0" v-for="i in curate.curationVp % 5" :key="i" src="~@/assets/icons/vp1.gif" alt="" class="w-6 h-6">
          </div>
          <div class="flex flex-col items-end">
            <div class="whitespace-pre-line text-grey-normal font-normal">
              {{ formatAmount(curate.amount) }}
            </div>
            <div class="text-sm text-grey-light-active">
              {{ parseTimestamp(new Date(curate.createAt).getTime() - 8*60*60*1000) }}
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
