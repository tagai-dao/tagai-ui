import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet, newLike, newRetweet, newReply, newQuote, newCurate } from "@/apis/api";
import errCode from "@/errCode";
import { GlobalModalType, type BattleData, type Tweet } from "@/types";
import { OP_CONSUME, VP_CONSUME } from "@/config";
import { useModalStore } from "@/stores/common";
import { notify } from "@/utils/notify";
import i18n from "@/lang";
import { isAddress } from "viem";
import { computed } from "vue";

const t = i18n.global.t


export const usePredict = (battle: BattleData) => {

    const reserveA = computed(() => battle.reserveA)
    const reserveB = computed(() => battle.reserveB)

    const totalPool = computed(() => (battle.reserveA ?? 0) + (battle.reserveB ?? 0))

    const percentA = computed(() => {
        if (totalPool.value === 0) return 50
        return (reserveB.value ?? 0) / totalPool.value
    })
    
    const percentB = computed(() => {
        if (totalPool.value === 0) return 50
        return (reserveA.value ?? 0) / totalPool.value
    })

    return {
        percentA,
        percentB
    }
}