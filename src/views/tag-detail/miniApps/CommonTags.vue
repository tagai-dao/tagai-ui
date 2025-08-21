<template>
    <div>

        <div class="flex justify-center h-full" v-if="showingTweets.length === 0">
            <img src="~@/assets/images/empty-data.svg" class="w-16 h-16 mt-48" alt="">
        </div>
    <van-pull-refresh class="h-full min-h-full" v-else
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
        @load="onLoad"
      >
        <div v-for="(tweet, index) of showingTweets" :key="tweet.tweetId" class="mb-2">
          <SpaceItem
            v-if="tweet.spaceId"
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/space-detail/${tweet.tweetId}`)"
          >
            <template #tweet-action-bar>
              <PostButtonGroup
                @click.stop
                :tweet="tweet"
              />
            </template>
          </SpaceItem>
          <TweetItem
            v-else
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/post-detail/${tweet.tweetId}`)"
          >
            <template #tweet-action-bar>
              <PostButtonGroup
                @click.stop
                :tweet="tweet"
              />
            </template>
          </TweetItem>
        </div>
      </van-list>
    </van-pull-refresh>
    </div>
  </template>
  
  <script setup lang="ts">
import type { MiniApp, Tweet } from '@/types';
import { onMounted, ref } from 'vue';
import { getCommunityTweetsWithTag } from '@/apis/api';
import { useAccountStore } from '@/stores/web3';
import { handleErrorTip, handleServerError } from '@/utils/notify';
import { useCurationStore } from '@/stores/curation';

  const props = defineProps<{
    appData: MiniApp
  }>()

  const refreshing = ref(false)
  const loading = ref(false)
  const finished = ref(false)

  const accStore = useAccountStore()
  const showingTweets = ref<Tweet[]>([])
  const curationStore = useCurationStore()


  async function onRefresh() {
    try {
        if (refreshing.value || loading.value) return;
        refreshing.value = true
        finished.value =false
        if (props.appData && props.appData.type === 1) {
            const res: any = await getCommunityTweetsWithTag(props.appData.tick, props.appData.tag, 0, accStore.getAccountInfo?.twitterId)
            console.log(432, res)
            showingTweets.value = res
            if (res.length < 30) {
                finished.value = true
            }
        }
    } catch (error) {
        handleErrorTip(error);
    } finally {
        refreshing.value = false
    }
  }

  async function onLoad () {
    try {
        if(refreshing.value || loading.value || finished.value || showingTweets.value.length === 0) return;
        loading.value = true;
        const res: any = await getCommunityTweetsWithTag(props.appData.tick, props.appData.tag, showingTweets.value.length, accStore.getAccountInfo?.twitterId)
        showingTweets.value = showingTweets.value.concat(res)
        if (res.length < 30) {
            finished.value = true
        }
    } catch (error) {
        handleErrorTip(error);
    } finally {
        loading.value = false
    }
  }

  onMounted(async () => {
    onRefresh()
  })
  </script>


  <style scoped>      
  
  </style>