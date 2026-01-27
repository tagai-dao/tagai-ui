<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getAggPredictBattleData, getAggPredictEventData } from '@/apis/api'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType, type BattleData, type Tweet, type EventPredictData } from '@/types'
import { useI18n } from 'vue-i18n'
import PredictBattleCard from '@/components/common/PredictBattleCard.vue'
import PredictEventCard from '@/components/common/PredictEventCard.vue'
import { getMarketInfos } from '@/utils/fpmm'

const props = defineProps<{
    type: number
    predictType?: 'battle' | 'event'
}>()

// Tab 切换 - 根据外部传入的 predictType 决定，如果没有传入则默认为 event（事件预测）
const activeTab = ref<'battle' | 'event'>((props.predictType as 'battle' | 'event') || 'event')

// 对战预测相关状态
const battleRefreshing = ref(false)
const battleLoading = ref(false)
const battleFinishedMap = ref<{
    [key: number]: boolean
}>({})
const battles = ref<{
    [key: number]:BattleData[]
}>({})
let tweets = reactive<{ [key: string]: Tweet }>({})

// 事件预测相关状态
const eventRefreshing = ref(false)
const eventLoading = ref(false)
const eventFinishedMap = ref<{
    [key: number]: boolean
}>({})
const events = ref<{
    [key: number]:EventPredictData[]
}>({})

watch(() => props.type, async () => {
    if (activeTab.value === 'battle') {
        await onBattleRefresh()
    } else {
        await onEventRefresh()
    }
})

watch(() => props.predictType, (newType) => {
    if (newType) {
        activeTab.value = newType
        // 切换类型时刷新数据
        if (newType === 'battle') {
            if (!battles.value[props.type] || battles.value[props.type].length === 0) {
                onBattleRefresh()
            }
        } else {
            if (!events.value[props.type] || events.value[props.type].length === 0) {
                onEventRefresh()
            }
        }
    }
}, { immediate: true })

watch(() => activeTab.value, async () => {
    if (activeTab.value === 'battle') {
        if (!battles.value[props.type] || battles.value[props.type].length === 0) {
            await onBattleRefresh()
        }
    } else {
        if (!events.value[props.type] || events.value[props.type].length === 0) {
            await onEventRefresh()
        }
    }
})

const router = useRouter()
const accStore = useAccountStore()
const modalStore = useModalStore()
const i18n = useI18n()

// ========== 对战预测相关方法 ==========
async function onBattleRefresh() {
    try {
        battleRefreshing.value = true
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
        battleRefreshing.value = false
    }
}

async function onBattleLoad() {
    try {
        if (battleLoading.value || battleFinishedMap.value[props.type] || battles.value[props.type]?.length === 0) return
        battleLoading.value = true
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
            battleFinishedMap.value[props.type] = true
        }
    } catch (error) {
        console.log(59, error)
    } finally {
        battleLoading.value = false
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

// ========== 事件预测相关方法 ==========
async function onEventRefresh() {
    try {
        eventRefreshing.value = true
        const data: any = await getAggPredictEventData(props.type, 0)
        if (data && data.length > 0) {
            const marketInfos = await getMarketInfos(data as EventPredictData[])
            events.value[props.type] = (data as EventPredictData[]).map(event => ({
                ...event,
                winner: getEventWinner(event),
                reserveA: marketInfos[event.marketMaker + '-priceA'],
                reserveB: marketInfos[event.marketMaker + '-priceB'],
                fee: marketInfos[event.marketMaker + '-fee']
            }))
        } else {
            events.value[props.type] = []
        }
    } catch (error) {
        console.log('Event refresh error:', error)
    } finally {
        eventRefreshing.value = false
    }
}

async function onEventLoad() {
    try {
        if (eventLoading.value || eventFinishedMap.value[props.type] || events.value[props.type]?.length === 0) return
        eventLoading.value = true
        const data: any = await getAggPredictEventData(props.type, Math.floor((events.value[props.type]?.length - 1) / 16) + 1)
        if (data && data.length > 0) {
            const marketInfos = await getMarketInfos(data as EventPredictData[])
            events.value[props.type] = events.value[props.type].concat((data as EventPredictData[]).map(event => ({
                ...event,
                winner: getEventWinner(event),
                reserveA: marketInfos[event.marketMaker + '-priceA'],
                reserveB: marketInfos[event.marketMaker + '-priceB'],
                fee: marketInfos[event.marketMaker + '-fee']
            })))
        }
        if (!data || data.length < 30) {
            eventFinishedMap.value[props.type] = true
        }
    } catch (error) {
        console.log('Event load error:', error)
    } finally {
        eventLoading.value = false
    }
}

// 判断事件预测胜利者
const getEventWinner = (event: EventPredictData): 'yes' | 'no' | null => {
    if (event.status == 3 || event.endTime * 1000 + 86400000 < Date.now()) {
        return (event.voteYes ?? 0) > (event.voteNo ?? 0) ? 'yes' : 'no'
    }
    return null
}

onMounted(async () => {
    // 根据默认的 activeTab 决定初始加载哪个数据
    if (activeTab.value === 'battle') {
        await onBattleRefresh()
    } else {
        await onEventRefresh()
    }
})

</script>

<template>
    <div class="predict-container rounded-t-2xl overflow-hidden flex flex-col h-full">

        <!-- 对战预测 Tab -->
        <div v-if="activeTab === 'battle'" class="predict-battle-container rounded-t-2xl overflow-hidden flex flex-col h-full px-4">
            <van-pull-refresh class="flex-1 overflow-y-auto"
                v-model="battleRefreshing"
                @refresh="onBattleRefresh"
                :loading-text="$t('loading')"
                :lpulling-text="$t('pullToRefreshData')"
                :loosing-text="$t('releaseToRefresh')"
            >
                <van-list
                    :loading="battleLoading"
                    :finished="battleFinishedMap[props.type]"
                    :immediate-check="false"
                    :finished-text="$t('noMore')"
                    :offset="50"
                    @load="onBattleLoad"
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

        <!-- 事件预测 Tab -->
        <div v-else class="predict-event-container rounded-t-2xl overflow-hidden flex flex-col h-full">
            <van-pull-refresh class="flex-1 overflow-y-auto"
                v-model="eventRefreshing"
                @refresh="onEventRefresh"
                :loading-text="$t('loading')"
                :lpulling-text="$t('pullToRefreshData')"
                :loosing-text="$t('releaseToRefresh')"
            >
                <van-list
                    :loading="eventLoading"
                    :finished="eventFinishedMap[props.type]"
                    :immediate-check="false"
                    :finished-text="$t('noMore')"
                    :offset="50"
                    @load="onEventLoad"
                >
                    <div v-if="events[props.type]?.length === 0" class="w-full flex my-8 justify-center items-center">
                        <img src="~@/assets/images/empty-data.svg" alt="">
                    </div>
                    <div v-else class="px-4">
                        <PredictEventCard v-for="event in events[props.type]" :key="event.marketMaker" :market="event" :showCommunity="true" />
                    </div>
                </van-list>
            </van-pull-refresh>
        </div>
    </div>
</template>