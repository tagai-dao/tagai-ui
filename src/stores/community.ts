import { defineStore } from "pinia";
import type { Community } from "@/types";
import { ref } from "vue";

export const useCommunityStore = defineStore(
    'community', () => {
        const allCommunities = ref<Community[]>([])
        const trendingCommunities = ref<Community[]>([])
        const newCommunities = ref<Community[]>([])
        const currentSelectedCommunities = ref<Community | null>(null)
        return {
            allCommunities,
            trendingCommunities,
            newCommunities,
            currentSelectedCommunities
        }
    })
