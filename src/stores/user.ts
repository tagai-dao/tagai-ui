import { defineStore } from "pinia";
import type { Community, TokenHoldingList } from "@/types";
import { ref } from "vue";

export const useUserStore = defineStore(
    'user', () => {
        const tokenHoldingList = ref<TokenHoldingList[]>([])
        return {
            tokenHoldingList
        }
    }
)
