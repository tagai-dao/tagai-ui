<template>
  <div class="flex justify-center h-full" v-if="showingTweets.length === 0">
    <img src="~@/assets/images/empty-data.svg" class="w-16 h-16 mt-48" alt="">
  </div>
  <div v-else class="flex-1">
    <div class="w-full overflow-x-auto no-scroll-bar mb-2">
      <div class="flex gap-2 items-stretch">
        <div v-for="(tweet, index) of showingTweets.slice(0,5)" :key="tweet.tweetId"
             class="min-w-[300px] bg-white rounded-2xl">
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
              :show-market-cap="false"
              :text-only="true"
              @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/post-detail/${tweet.tweetId}`)"
          >
            <template #tweet-action-bar>
              <PostButtonGroup @click.stop :tweet="tweet"/>
            </template>
          </TweetItem>
        </div>
      </div>
    </div>
    <van-pull-refresh v-if="showingTweets.length>0"
                      class="h-full min-h-full"
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
  
  import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
  import TweetItem from "@/components/tweets/TweetItem.vue";
  import SpaceItem from "@/components/tweets/SpaceItem.vue";
  import {onMounted, ref} from "vue";
  import {useAccountStore} from "@/stores/web3";
  import type {Tweet} from "@/types";
  import {handleErrorTip} from "@/utils/notify";
  import {getNewTweets} from "@/apis/api";
  import {getTokenInfoOfTweets} from "@/utils/pump";
  import {useCommunityStore} from "@/stores/community";
  import {useCurationStore} from "@/stores/curation";

  const accStore = useAccountStore();
  const comStore = useCommunityStore();
  const curationStore = useCurationStore()
  const refreshing = ref(false);
  const loading = ref(false);
  const finished = ref(false)

  const showingTweets = ref<Tweet[]>([])

  async function onRefresh() {
    try {
      refreshing.value = true;
      finished.value = false;
      let list: Tweet[] = []
      list = await getNewTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      list = await getTokenInfoOfTweets(list)
      showingTweets.value = list
      if (list.length < 30) {
        finished.value = true
      }
    } catch (e) {
      handleErrorTip(e)
    } finally {
      refreshing.value = false;
    }
  }

  async function onLoad() {
    try{
      if (refreshing.value || finished.value || showingTweets.value.length === 0) {
        return;
      }
      loading.value = true
      let list: Tweet[] = []
      list = await getNewTweets(accStore.getAccountInfo?.twitterId, Math.floor((showingTweets.value.length - 1) / 30) + 1) as Tweet[]
      list = await getTokenInfoOfTweets(list)
      showingTweets.value = showingTweets.value.concat(list)

    } catch (e) {
      handleErrorTip(e)
    } finally {
      loading.value = false;
    }
  }

  onMounted(async () => {
    await onRefresh();
  });

  </script>
  
  <style scoped>      
  
  </style>