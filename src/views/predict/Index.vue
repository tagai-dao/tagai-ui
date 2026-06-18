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
import { getMarketInfos, applyMulticallInfosToEvent } from '@/utils/fpmm'
import { getResolvedWinningOutcomeIndex } from '@/composables/useEventMarketOutcomes'
import { computed } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useStateStore } from '@/stores/common'
import { getCommunitiesByTrending } from '@/apis/api'
import { formatUsdCompact } from '@/utils/format'
import { isWorldCupMarket } from '@/composables/useWorldCupMarkets'
import { useCommunityTokenPrice } from '@/composables/useCommunityTokenPrice'
import { predictVolTokenAmount } from '@/utils/predictVol'

const props = defineProps<{
    type: number
    predictType?: 'battle' | 'event' | 'worldcup'
}>()

type PredictTab = 'battle' | 'event' | 'worldcup'

// Tab 切换 - 根据外部传入的 predictType 决定，如果没有传入则默认为 worldcup（世界杯）
const activeTab = ref<PredictTab>((props.predictType as PredictTab) || 'worldcup')

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

const comStore = useCommunityStore()
const stateStore = useStateStore()

// ===== 社区标签横滑条（按预测交易量 USD 排序）+ 筛选 =====
const selectedTick = ref<string>('')
const tagScroller = ref<HTMLElement>()
// 鼠标滚轮纵向滚动转为标签条横向滚动
const onTagWheel = (e: WheelEvent) => {
    if (tagScroller.value) tagScroller.value.scrollLeft += e.deltaY + e.deltaX
}

const { priceOfTick } = useCommunityTokenPrice()

// 事件类 tab 的全量数据：worldcup 是事件数据的子集；世界杯事件同时保留在 event tab 中
const eventsForTab = computed<EventPredictData[]>(() => {
    const list = events.value[props.type] ?? []
    return activeTab.value === 'worldcup' ? list.filter(isWorldCupMarket) : list
})

// 当前 tab 全量数据（筛选与聚合的共同来源）
const currentItems = computed<Array<BattleData | EventPredictData>>(() =>
    activeTab.value === 'battle' ? (battles.value[props.type] ?? []) : eventsForTab.value
)

// tick -> Σ(predictVolTokenAmount) × 社区币价 × BNB 美元价（与卡片 Vol 同口径）
const communityTags = computed(() => {
    const funds: Record<string, number> = {}
    for (const item of currentItems.value) {
        if (!item?.tick) continue
        const tokens = predictVolTokenAmount(item)
        if (!tokens) continue
        funds[item.tick] = (funds[item.tick] ?? 0) + tokens * priceOfTick(item.tick) * stateStore.ethPrice
    }
    return Object.entries(funds)
        .sort((a, b) => b[1] - a[1])
        .map(([tick, usd]) => ({ tick, usd }))
})

const filteredBattles = computed(() =>
    selectedTick.value ? (battles.value[props.type] ?? []).filter(b => b.tick === selectedTick.value) : (battles.value[props.type] ?? [])
)
const filteredEvents = computed(() =>
    selectedTick.value ? eventsForTab.value.filter(e => e.tick === selectedTick.value) : eventsForTab.value
)

// tab 切换时若选中的社区在新列表不存在，回到全部
watch(currentItems, () => {
    if (selectedTick.value && !currentItems.value.some(i => i.tick === selectedTick.value)) {
        selectedTick.value = ''
    }
})

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
            const list = data as EventPredictData[]
            const marketInfos = list.length
                ? await getMarketInfos(eventsNeedingChainReserves(list))
                : {}
            events.value[props.type] = list.map(event => mapEventWithMarketInfos(event, marketInfos))
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
            const list = data as EventPredictData[]
            const marketInfos = list.length
                ? await getMarketInfos(eventsNeedingChainReserves(list))
                : {}
            events.value[props.type] = events.value[props.type].concat(
                list.map(event => mapEventWithMarketInfos(event, marketInfos)),
            )
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

const mapEventWithMarketInfos = (event: EventPredictData, marketInfos: Record<string, number>) => ({
    ...event,
    winner: getEventWinner(event),
    ...applyMulticallInfosToEvent(event, marketInfos),
})

/** 交易期内市场才批量拉链上储备（已结束用 DB 快照） */
const eventsNeedingChainReserves = (list: EventPredictData[]) =>
    list.filter(e => e.status < 2 && Date.now() < e.endTime * 1000)

// 判断事件预测胜利者
const getEventWinner = (event: EventPredictData): 'yes' | 'no' | null => {
    const idx = getResolvedWinningOutcomeIndex(event)
    if (idx === 0) return 'yes'
    if (idx === 1) return 'no'
    return null
}

onMounted(async () => {
    // 直入 /predictions 时 comStore 列表为空，拉一次 trending 供 USD 换算
    if (!comStore.trendingCommunities?.length) {
        getCommunitiesByTrending().then((list: any) => {
            if (Array.isArray(list) && list.length) comStore.trendingCommunities = list
        }).catch(() => {})
    }
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

        <!-- 顶栏：左侧社区标签横滑条（按参与资金 USD 排序），右侧预测类型下拉 -->
        <div class="flex items-center gap-3 px-4 pt-2 pb-1">
            <div ref="tagScroller" @wheel.prevent="onTagWheel"
                 class="flex-1 flex items-center gap-2 overflow-x-auto no-scroll-bar whitespace-nowrap min-w-0">
                <button class="h-8 px-4 rounded-full text-sm whitespace-nowrap transition-colors flex-shrink-0"
                        :class="selectedTick === '' ? 'bg-gradient-primary text-white font-semibold' : 'bg-white text-black hover:bg-gray-50'"
                        @click="selectedTick = ''">
                    {{ $t('all') }}
                </button>
                <button v-for="tag of communityTags" :key="tag.tick"
                        class="h-8 px-4 rounded-full text-sm whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5"
                        :class="selectedTick === tag.tick ? 'bg-gradient-primary text-white font-semibold' : 'bg-white text-black hover:bg-gray-50'"
                        :title="formatUsdCompact(tag.usd)"
                        @click="selectedTick = selectedTick === tag.tick ? '' : tag.tick">
                    <span>#{{ tag.tick }}</span>
                    <span v-if="tag.usd >= 0.01" class="text-xs opacity-70 tabular-nums">{{ formatUsdCompact(tag.usd) }}</span>
                </button>
            </div>
            <el-select v-model="activeTab"
                       class="bg-white rounded-full overflow-hidden w-[190px] min-w-[120px] c-select h-9 flex items-center text-sm text-black flex-shrink-0"
                       popper-class="c-select-popper rounded-xl">
                <el-option value="worldcup" :label="$t('createPredict.tabWorldCup') + ' 🏆'" />
                <el-option value="event" :label="$t('createPredict.tabEvent')" />
                <el-option value="battle" :label="$t('createPredict.tabBattle')" />
            </el-select>
        </div>

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
                    <div v-if="filteredBattles.length === 0" class="w-full flex my-8 justify-center items-center">
                        <img src="~@/assets/images/empty-data.svg" alt="">
                    </div>
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PredictBattleCard class="!mb-0" showCommunity :battle="battle" :tweets="tweets" v-for="battle in filteredBattles" :key="battle.predictAID + battle.predictBID" />
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
                    <div v-if="filteredEvents.length === 0" class="w-full flex my-8 justify-center items-center">
                        <img src="~@/assets/images/empty-data.svg" alt="">
                    </div>
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                        <PredictEventCard class="!mb-0" v-for="event in filteredEvents" :key="event.marketMaker" :market="event" :showCommunity="true" />
                    </div>
                </van-list>
            </van-pull-refresh>
        </div>
    </div>
</template>