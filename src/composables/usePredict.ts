import { useAccountStore } from "@/stores/web3";
import { useAccount } from "./useAccount";
import { tweet, newLike, newRetweet, newReply, newQuote, newCurate } from "@/apis/api";
import errCode from "@/errCode";
import { GlobalModalType, type BattleData, type EventPredictData, type Tweet } from "@/types";
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
    const isSettled = computed(() => battle.status === 2)

    const percentA = computed(() => {
        if (battle.solvedBalances) {
            if (typeof battle.solvedBalances === 'string') {
                try {
                    battle.solvedBalances = JSON.parse(battle.solvedBalances) as Array<number>
                } catch (error) {
                    
                }
            }
            if (battle.solvedBalances.length > 0) {
                return battle.solvedBalances[1] / (battle.solvedBalances[0] + battle.solvedBalances[1])
            }
        }
        if (totalPool.value === 0) return 0.5
        return (reserveB.value ?? 0) / totalPool.value
    })
    
    const percentB = computed(() => {
        if (battle.solvedBalances) {
            if (typeof battle.solvedBalances === 'string') {
                try {
                    battle.solvedBalances = JSON.parse(battle.solvedBalances) as Array<number>
                } catch (error) {
                    
                }
            }
            if (battle.solvedBalances.length > 0) {
                return battle.solvedBalances[0] / (battle.solvedBalances[0] + battle.solvedBalances[1])
            }
        }
        if (totalPool.value === 0) return 0.5
        return (reserveA.value ?? 0) / totalPool.value
    })

    return {
        percentA,
        percentB
    }
}


export const useEventPredict = (market: EventPredictData) => {

    const reserveA = computed(() => market.reserveA)
    const reserveB = computed(() => market.reserveB)

    const totalPool = computed(() => (market.reserveA ?? 0) + (market.reserveB ?? 0))
    const isSettled = computed(() => market.status === 2)

    const percentA = computed(() => {
        if (market.solvedBalances) {
            if (typeof market.solvedBalances === 'string') {
                try {
                    market.solvedBalances = JSON.parse(market.solvedBalances) as Array<number>
                } catch (error) {
                    
                }
            }
            if (market.solvedBalances.length > 0) {
                return market.solvedBalances[1] / (market.solvedBalances[0] + market.solvedBalances[1])
            }
        }
        if (totalPool.value === 0) return 0.5
        return (reserveB.value ?? 0) / totalPool.value
    })
    
    const percentB = computed(() => {
        if (market.solvedBalances) {
            if (typeof market.solvedBalances === 'string') {
                try {
                    market.solvedBalances = JSON.parse(market.solvedBalances) as Array<number>
                } catch (error) {
                    
                }
            }
            if (market.solvedBalances.length > 0) {
                return market.solvedBalances[0] / (market.solvedBalances[0] + market.solvedBalances[1])
            }
        }
        if (totalPool.value === 0) return 0.5
        return (reserveA.value ?? 0) / totalPool.value
    })

    return {
        percentA,
        percentB
    }
}