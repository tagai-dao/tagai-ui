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

export type HomeNewSource = 'x' | 'fomo' | 'gmgn' | 'pump'

export const useTweetsStore = defineStore("tweets", () => {
  const homeTweetType = ref<TweetListType>(TweetListType.New)
  const homeNewSource = ref<HomeNewSource>('x')
  const newTweets = ref<Tweet[]>([]);
  const trendingTweets = ref<Tweet[]>([]);
  const currentSelectedTweet = ref<Tweet | null>(null);
  const communityTweets = ref<CommunityTweets>();
  const communitySpaceTweets = ref<CommunityTweets>();  
  const communityTrendingTweets = ref<CommunityTweets>();
  const communityTippedTweets = ref<CommunityTweets>();
  /** Keyed by `${tick}:${source}` for GMGN/FOMO/Pump native callout feeds. */
  const communityCalloutTweets = ref<CommunityTweets>();
  return {
    homeTweetType,
    homeNewSource,
    newTweets,
    trendingTweets,
    currentSelectedTweet,
    communityTweets,
    communitySpaceTweets,
    communityTrendingTweets,
    communityTippedTweets,
    communityCalloutTweets
  };
});
