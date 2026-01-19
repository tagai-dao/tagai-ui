<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getAggPredictBattleData } from '@/apis/api'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType, type BattleData, type Tweet } from '@/types'
import { useI18n } from 'vue-i18n'
import PredictBattleCard from '@/components/common/PredictBattleCard.vue'
import { getMarketInfos } from '@/utils/fpmm'

const refreshing = ref(false)
const loading = ref(false)
const finishedMap = ref<{
    [key: number]: boolean
}>({})
const battles = ref<{
    [key: number]:BattleData[]
}>({})
let tweets = reactive<{ [key: string]: Tweet }>({})

const props = defineProps<{
    type: number
}>()

watch(() => props.type, async () => {
    await onRefresh()
})

const router = useRouter()
const accStore = useAccountStore()
const modalStore = useModalStore()
const i18n = useI18n()

async function onRefresh() {
    try {
        refreshing.value = true
        const data: any = await getAggPredictBattleData(props.type, 0)
        if (data.battle && data.battle.length > 0) {
          const marketInfos = await getMarketInfos(data.battle as BattleData[])
            tweets = Object.assign({}, data.tweets)
            battles.value[props.type] = (data.battle as BattleData[]).map(battle => ({
                ...battle,
                winner: getWinner(battle),
                reserveA: marketInfos[battle.marketMaker + '-priceA'],
                reserveB: marketInfos[battle.marketMaker + '-priceB'],
                fee: marketInfos[battle.marketMaker + '-fee']
            }))

        }else {
            battles.value[props.type] = []
        }

    } catch (error) {
        console.log(57, error)
    } finally {
        refreshing.value = false
    }
}

async function onLoad() {
    try {
        if (loading.value || finishedMap.value[props.type] || battles.value[props.type]?.length === 0) return
        loading.value = true
        const data: any = await getAggPredictBattleData(props.type, Math.floor((battles.value[props.type]?.length - 1) / 16) + 1)
        if (data.battle && data.battle.length > 0) {
            const marketInfos = await getMarketInfos(data.battle as BattleData[])
            tweets = Object.assign(tweets, data.tweets)
            battles.value[props.type] = battles.value[props.type].concat((data.battle as BattleData[]).map(battle => ({
                ...battle,
                winner: getWinner(battle),
                reserveA: marketInfos[battle.marketMaker + '-priceA'],
                reserveB: marketInfos[battle.marketMaker + '-priceB'],
                fee: marketInfos[battle.marketMaker + '-fee']
            })))
        }
        if (!data.battle || data.battle.length < 30) {
            finishedMap.value[props.type] = true
        }
    } catch (error) {
        console.log(59, error)
    } finally {
        loading.value = false
    }
}

// 判断胜利者
const getWinner = (battle: BattleData): 'left' | 'right' | null => {
    const tweetA = tweets[battle.predictAID]
    const tweetB = tweets[battle.predictBID]
    if (tweetA && tweetB) {
        if (tweetA.isSettled && tweetB.isSettled) {
            return (battle.amounta || (tweetA.amount ?? 0)) > (battle.amountb || (tweetB.amount ?? 0)) ? 'left' : 'right'
        }
        return null
    }
    return null
}

onMounted(async () => {
    await onRefresh()
})

</script>

<template>
    <div class="predict-battle-container rounded-t-2xl overflow-hidden flex flex-col h-full px-4">
        <!-- <div class="flex justify-end items-center p-2 shrink-0">
            <button class="flex gap-2 items-center cursor-pointer px-4 py-0 rounded-full bg-gradient-primary text-white"
                    >
                <span class="text-2xl">+</span>
                <span class="whitespace-nowrap">{{$t('createPredictBattle')}}</span>
            </button>
        </div> -->
        <van-pull-refresh class="flex-1 overflow-y-auto"
        v-model="refreshing"
        @refresh="onRefresh"
        :loading-text="$t('loading')"
        :lpulling-text="$t('pullToRefreshData')"
        :loosing-text="$t('releaseToRefresh')"
        >
        <van-list
            :loading="loading"
            :finished="finishedMap[props.type]"
            :immediate-check="false"
            :finished-text="$t('noMore')"
            :offset="50"
            @load="onLoad"
        >

        <div v-if="battles[props.type]?.length === 0" class="w-full flex my-8 justify-center items-center">
                <img src="~@/assets/images/empty-data.svg" alt="">
                </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PredictBattleCard class="!mb-0" showCommunity :battle="battle" :tweets="tweets" v-for="battle in battles[props.type]" :key="battle.predictAID + battle.predictBID" />
        </div>
        </van-list>
        </van-pull-refresh>
  </div>
</template>