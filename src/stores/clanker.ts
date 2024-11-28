import { defineStore } from "pinia";
import type { ClankerToken, Tweet } from "@/types";
import { ref } from "vue";

export const useClankerStore = defineStore(
    'clanker', () => {
        const allClankerTokens = ref<ClankerToken[]>([])
        const currentSelectedClanker = ref<ClankerToken | null>(null)
        const tweets = ref<Tweet[]>([])
        return {
            allClankerTokens,
            currentSelectedClanker,
            tweets
        }
    }
)
