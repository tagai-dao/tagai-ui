<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getPredictBattleData, getPredictEventData } from '@/apis/api'
import { type BattleData, type EventPredictData } from '@/types'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip } from '@/utils/notify'
import { useAccountStore } from '@/stores/web3'
import emitter from '@/utils/emitter'
import PredictEventCard from '@/components/common/PredictEventCard.vue'
import { getMarketInfos, applyMulticallInfosToEvent } from '@/utils/fpmm'
import { getResolvedWinningOutcomeIndex } from '@/composables/useEventMarketOutcomes'

// Event 组件暂时复用 Battle 的逻辑和数据源
const comStore = useCommunityStore()
const accStore = useAccountStore()
const markets = ref<EventPredictData[]>([])

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)

const getWinner = (market: EventPredictData): 'yes' | 'no' | null => {
  const idx = getResolvedWinningOutcomeIndex(market)
  if (idx === 0) return 'yes'
  if (idx === 1) return 'no'
  return null
}

const eventsNeedingChainReserves = (list: EventPredictData[]) =>
    list.filter(e => e.status < 2 && Date.now() < e.endTime * 1000)

const mapEventWithMarketInfos = (market: EventPredictData, marketInfos: Record<string, number>) => ({
    ...market,
    winner: getWinner(market),
    ...applyMulticallInfosToEvent(market, marketInfos),
})

const onRefresh = async () => {
    try {
        if (refreshing.value) return
        refreshing.value = true
        const data: any = await getPredictEventData(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId)

        if (data && data.length > 0) {
          const list = data as EventPredictData[]
          const marketInfos = list.length
            ? await getMarketInfos(eventsNeedingChainReserves(list))
            : {}
            markets.value = list.map(market => mapEventWithMarketInfos(market, marketInfos))
        }else {
            markets.value = []
        }

        if (!data || data.length < 16) {
            finished.value = true
        }
    } catch (error) {
        handleErrorTip(error)
    } finally {
        refreshing.value = false
    }
}

const onLoad = async () => {
    try {
        if (loading.value || finished.value || markets.value.length === 0) return
        loading.value = true
        // TODO: 这里后续替换为 Event 的数据源接口
        const data: any = await getPredictEventData(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, Math.floor((markets.value.length - 1) / 16) + 1) as EventPredictData[]
        if (data && data.length > 0) {
          const list = data as EventPredictData[]
          const marketInfos = list.length
            ? await getMarketInfos(eventsNeedingChainReserves(list))
            : {}
          markets.value = markets.value.concat(
            list.map(market => mapEventWithMarketInfos(market, marketInfos)),
          )
        }
        if (!data || data.length < 16) {
            finished.value = true
        }
    } catch (error) {
        handleErrorTip(error)
    } finally {
        loading.value = false
    }
}

// 判断胜利者（见上方 getWinner）
defineExpose({
  onRefresh
})

onMounted(async () => {
  await onRefresh()
  emitter.on('createPredictSuccess', onRefresh);
})

</script>

<template>
  <div class="predict-event-container rounded-t-2xl overflow-y-auto h-full">
    <!-- 移除了顶部的创建按钮 -->
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
        @load="onLoad"
      >

      <div v-if="markets.length === 0" class="w-full flex my-8 justify-center items-center">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>

            <PredictEventCard v-else :market v-for="market in markets" :key="market.marketMaker" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.predict-event-container {
  height: 100%;
  background-color: var(--app-bg);
}

/* 复用 BattleCard 的相关样式 */
.battle-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.battle-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

/* 自定义滚动条 */
.predict-event-container::-webkit-scrollbar {
  width: 6px;
}

.predict-event-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.predict-event-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.predict-event-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>
