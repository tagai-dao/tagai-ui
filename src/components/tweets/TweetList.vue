<template>
    <div v-for="(tweet, index) of tweets" :key="index" class="border-b-1 border-white pb-[30px] mb-10px">
      <TweetItem :tweet="tweet" @click="gotoDetail(tweet)">
<!--        <template #tweet-mint>-->
<!--          <TweetMint @click.stop :goods="tweet.goods" :tweet-id="tweet.tweetId"/>-->
<!--        </template>-->
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop :post="tweet"/>
        </template>
      </TweetItem>
    </div>
</template>

<script setup lang="ts">
import { getTweetsByNew, getTweetsByTrending } from "@/apis/api";
import { onMounted, ref, computed } from "vue"
import { useRouter } from 'vue-router'
import type { Tweet } from "@/types";
import { useTweetsStore } from "@/stores/tweets";
import { handleServerError } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import TweetItem from "@/components/tweets/TweetItem.vue";

const isRefreshing = ref(false)
const isLoading = ref(false)
const isFinished = ref(false)
const router = useRouter()
const tweetsStore = useTweetsStore()
const accStore = useAccountStore()

const tweets = computed<Array<Tweet>>(() => {
  if (props.type === 'new') {
    return tweetsStore.allTweets
  }else if (props.type === 'trending') {
    return tweetsStore.trendingTweets
  }
  return []
})

const props = defineProps<{
    type: string
}>()

function newLike(tweetId: string) {
  if (props.type === 'new') {
     tweetsStore.allTweets.forEach(tweet => {
        if (tweet.tweetId === tweetId) {
          tweet.likeCount = (tweet.likeCount ?? 0) + 1
          tweet.liked = true
        }
     });
  }else if (props.type === 'trending') {
    tweetsStore.trendingTweets.forEach(tweet => {
        if (tweet.tweetId === tweetId) {
          tweet.likeCount = (tweet.likeCount ?? 0) + 1
          tweet.liked = true
        }
     });
  }
}

function newComment(tweetId: string, commentId: string, text: string) {
  if (props.type === 'new') {
     tweetsStore.allTweets.forEach(tweet => {
        if (tweet.tweetId === tweetId) {
          tweet.commentCount = (tweet.commentCount ?? 0) + 1
          tweet.commented = true
        }
     });
  }else if (props.type === 'trending') {
    tweetsStore.trendingTweets.forEach(tweet => {
        if (tweet.tweetId === tweetId) {
          tweet.commentCount = (tweet.commentCount ?? 0) + 1
          tweet.commented = true
        }
     });
  }
}

async function gotoDetail(tweet: Tweet) {
  tweetsStore.currentSelectedTweet = tweet
  await router.push('/tweet/' + tweet.tweetId)
}

async function onRefresh() {
    try{
        if (isRefreshing.value || isLoading.value) return
        isRefreshing.value = true
        if (props.type === 'new') {
          let data = await getTweetsByNew(accStore.twitter.twitterId)
          tweetsStore.allTweets = data as Tweet[]
        }else if (props.type === 'trending') {
          let data = await getTweetsByTrending(accStore.twitter.twitterId)
          tweetsStore.trendingTweets = data as Tweet[]
        }
    } catch (e) {
      handleServerError(e as number)
    } finally {
        isRefreshing.value = false
    }
}

async function onLoad() {
  try{
        if (isRefreshing.value || isLoading.value || isFinished || tweets.value?.length === 0) return
        isRefreshing.value = true
        if (props.type === 'new') {
          let data = await getTweetsByNew(accStore.twitter.twitterId, tweetsStore.allTweets[tweetsStore.allTweets.length - 1].postTime)
          tweetsStore.allTweets = tweetsStore.allTweets.concat(data as Tweet[])
        }else if (props.type === 'trending') {
          let data = await getTweetsByTrending(accStore.twitter.twitterId, Math.ceil((tweets.value.length) / 30), 30)
          tweetsStore.trendingTweets = tweetsStore.trendingTweets.concat(data as Tweet[])
        }
    } catch (e) {
      handleServerError(e as number)
    } finally {
        isRefreshing.value = false
    }
}

onMounted(() => {
    onRefresh()
})

</script>

<style scoped></style>
