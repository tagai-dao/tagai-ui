import { defineStore } from "pinia";
import type { Community, Tweet } from "@/types";
import { ref } from "vue";

export interface CommunityTweets {
  [key: string]: Tweet[]
}

export enum TweetListType {
  Trending = 'trending',
  New = 'new'
}

export const useTweetsStore = defineStore("tweets", () => {
  const homeTweetType = ref<TweetListType>(TweetListType.Trending)
  const newTweets = ref<Tweet[]>([]);
  const trendingTweets = ref<Tweet[]>([]);
  const currentSelectedTweet = ref<Tweet | null>(null);
  const communityTweets = ref<CommunityTweets>();
  const communitySpaceTweets = ref<CommunityTweets>();  
  const communityTrendingTweets = ref<CommunityTweets>();
  const communityTippedTweets = ref<CommunityTweets>();
  return {
    homeTweetType,
    newTweets,
    trendingTweets,
    currentSelectedTweet,
    communityTweets,
    communitySpaceTweets,
    communityTrendingTweets,
    communityTippedTweets
  };
});
