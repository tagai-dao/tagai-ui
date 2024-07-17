import { defineStore } from "pinia";
import type { Space } from "@/types";
import { ref } from "vue";

export const useCurationStore = defineStore(
    'curation', () => {
        const allSpaces = ref<Space[]>([])
        const currentSelectedSpace = ref<Space | null>(null)
        return {
            allSpaces,
            currentSelectedSpace
        }
    })
