import { defineStore } from "pinia";
import type { Community, Tweet } from "@/types";
import { ref } from "vue";

export interface CommunityTweets {
  [key: string]: Tweet[]
}

export const useTweetsStore = defineStore("tweets", () => {
  const allTweets = ref<Tweet[]>([]);
  const trendingTweets = ref<Tweet[]>([]);
  const currentSelectedTweet = ref<Tweet | null>(null);
  const communityTweets = ref<CommunityTweets>();
  const communityTippedTweets = ref<CommunityTweets>();
  return {
    allTweets,
    trendingTweets,
    currentSelectedTweet,
    communityTweets,
    communityTippedTweets
  };
});
