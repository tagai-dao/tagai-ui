import { defineStore } from "pinia";
import type { Community } from "@/types";
import { ref } from "vue";
import type { CommunityChartPeriod } from '@/utils/communityChartPeriod'

export const useCommunityStore = defineStore(
    'community', () => {
        const allCommunities = ref<Community[]>([])
        const trendingCommunities = ref<Community[]>([])
        const marketCapCommunities = ref<Community[]>([])
        const newCommunities = ref<Community[]>([])
        const currentSelectedCommunity = ref<Community | null>(null)
        const chartQuote = ref<{ scope: string; period: CommunityChartPeriod; change: number | null }>({ scope: '', period: 'h24', change: null })
        return {
            allCommunities,
            trendingCommunities,
            marketCapCommunities,
            newCommunities,
            currentSelectedCommunity,
            chartQuote
        }
    }
)
