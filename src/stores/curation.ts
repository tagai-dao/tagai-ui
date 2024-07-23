import { defineStore } from "pinia";
import type { Space, Tweet } from "@/types";
import { ref } from "vue";

export const useCurationStore = defineStore(
    'curation', () => {
        const allSpaces = ref<Space[]>([])
        const currentSelectedSpace = ref<Space | null>(null)
        return {
            allSpaces,
            currentSelectedSpace,
            currentSelectedTweet: null as Tweet | null
        }
    })
