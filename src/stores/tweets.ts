import { defineStore } from "pinia";
import type { Tweet } from "@/types";
import { ref } from "vue";

export const useTweetsStore = defineStore("tweets", () => {
  const allTweets = ref<Tweet[]>([]);
  const trendingTweets = ref<Tweet[]>([]);
  const currentSelectedTweet = ref<Tweet | null>(null);
  return {
    allTweets,
    trendingTweets,
    currentSelectedTweet,
  };
});
