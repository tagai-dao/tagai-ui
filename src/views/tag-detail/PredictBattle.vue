<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getPredictBattleData, tweet } from '@/apis/api'
import { GlobalModalType, type BattleData, type Tweet } from '@/types'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip } from '@/utils/notify'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import emitter from '@/utils/emitter'
import PredictBattleCard from '@/components/common/PredictBattleCard.vue'
import { getMarketInfos } from '@/utils/fpmm'

const comStore = useCommunityStore()
const accStore = useAccountStore()
const battles = ref<BattleData[]>([])
let tweets = reactive<{ [key: string]: Tweet }>({})

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)

const onRefresh = async () => {
    try {
        if (refreshing.value) return
        refreshing.value = true
        const data: any = await getPredictBattleData(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId)

        if (data.battle && data.battle.length > 0) {
          const marketInfos = await getMarketInfos(data.battle as BattleData[])
            tweets = Object.assign({}, data.tweets)
            battles.value = (data.battle as BattleData[]).map(battle => ({
                ...battle,
                winner: getWinner(battle),
                reserveA: marketInfos[battle.marketMaker + '-priceA'],
                reserveB: marketInfos[battle.marketMaker + '-priceB'],
                fee: marketInfos[battle.marketMaker + '-fee']
            }))
        }else {
            battles.value = []
        }

        if (!data.battle || data.battle.length < 16) {
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
        if (loading.value || finished.value || battles.value.length === 0) return
        loading.value = true
        const data: any = await getPredictBattleData(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, Math.floor((battles.value.length - 1) / 16) + 1) as BattleData[]
        if (data.battle && data.battle.length > 0) {
          const marketInfos = await getMarketInfos(data.battle as BattleData[])
          tweets = Object.assign(tweets, data.tweets)
          battles.value = battles.value.concat((data.battle as BattleData[]).map(battle => ({
              ...battle,
              winner: getWinner(battle),
              reserveA: marketInfos[battle.marketMaker + '-priceA'],
              reserveB: marketInfos[battle.marketMaker + '-priceB'],
              fee: marketInfos[battle.marketMaker + '-fee']
          })))
        }
        if (!data.battle || data.battle.length < 16) {
            finished.value = true
        }
    } catch (error) {
        handleErrorTip(error)
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
            return (tweetA.amount ?? 0) > (tweetB.amount ?? 0) ? 'left' : 'right'
        }
        return null
    }
    return null
}

const createPredictBattle = () => {
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return;
  }
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }

  useModalStore().setModalVisible(true, GlobalModalType.CreatePredict)
}

onMounted(async () => {
  await onRefresh()
  emitter.on('createPredictSuccess', onRefresh);
})

</script>

<template>
  <div class="predict-battle-container rounded-t-2xl overflow-hidden">
    <div class="flex justify-end items-center p-2">
      <button class="flex gap-2 items-center cursor-pointer px-4 py-0 rounded-full bg-gradient-primary text-white"
              @click="createPredictBattle">
        <span class="text-2xl -mt-1">+</span>
        <span class="whitespace-nowrap">{{$t('createPredictBattle')}}</span>
      </button>
    </div>
    <van-pull-refresh class="h-full min-h-full"
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

      <div v-if="battles.length === 0" class="w-full flex my-8 justify-center items-center">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
      <PredictBattleCard v-else :battle="battle" :tweets="tweets" v-for="battle in battles" :key="battle.predictAID + battle.predictBID" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.predict-battle-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.battle-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.battle-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

/* 玩家卡片样式 */
.player-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* 支持按钮样式 */
.support-btn {
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.support-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.support-btn:active::before {
  width: 300px;
  height: 300px;
}

.support-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* VS 标识样式 */
.vs-container {
  position: relative;
  z-index: 10;
  width: 5rem; /* 固定宽度 80px */
  flex-shrink: 0; /* 不允许收缩 */
}

.vs-bg {
  position: relative;
  z-index: 2;
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
  box-shadow: 
    0 15px 40px rgba(254, 145, 63, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.3),
    inset 0 2px 0 rgba(255, 255, 255, 0.4),
    inset 0 -2px 0 rgba(0, 0, 0, 0.1);
}

.vs-text {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
}

/* 浮动动画 */
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 脉冲动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.vs-indicator .animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* VS 装饰动画 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vs-indicator .animate-spin {
  animation: rotate 8s linear infinite;
}

/* 火焰动画 */
@keyframes flame {
  0%, 100% {
    transform: scale(1) rotate(-2deg);
  }
  50% {
    transform: scale(1.1) rotate(2deg);
  }
}

.absolute.-top-3.-right-3 {
  animation: flame 1.5s ease-in-out infinite;
}

/* 箭头脉冲动画 */
@keyframes arrowPulse {
  0%, 100% {
    opacity: 0.8;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.1);
  }
}

.absolute.-left-4,
.absolute.-right-4 {
  animation: arrowPulse 2s ease-in-out infinite;
}

.absolute.-left-4 {
  animation-delay: 0s;
}

.absolute.-right-4 {
  animation-delay: 1s;
}

/* 头像边框动画 */
.player-card .w-16 {
  transition: all 0.3s ease;
}

.player-card:hover .w-16 {
  transform: scale(1.1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

/* 在线状态指示器动画 */
.player-card .absolute.-bottom-1.-right-1 {
  animation: heartbeat 2s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .battle-card {
    margin: 0 -8px 0.75rem -8px; /* 保持底部边距 mb-3 (0.75rem) */
    border-radius: 1rem;
  }
  
  .vs-bg {
    width: 4rem;
    height: 4rem;
  }
  
  .vs-text {
    font-size: 1rem;
  }
  
  .player-card {
    padding: 0.5rem;
    min-height: 180px;
  }
  
  .player-card .w-16 {
    width: 3rem;
    height: 3rem;
  }
  
  .support-btn {
    padding: 0.75rem;
    font-size: 0.875rem;
  }
}

@media (max-width: 640px) {
  .battle-card {
    margin: 0 -4px 0.75rem -4px; /* 保持底部边距 mb-3 (0.75rem) */
    border-radius: 0.75rem;
  }
  
  .player-card {
    padding: 0.5rem;
    min-height: 160px;
  }
  
  .vs-container {
    width: 3rem;
    padding: 0 0.25rem;
  }
  
  .vs-bg {
    width: 3rem;
    height: 3rem;
  }
  
  .vs-text {
    font-size: 0.875rem;
  }
}

@media (max-width: 640px) {
  .flex.items-center.gap-4 {
    gap: 0.5rem;
  }
  
  .vs-container {
    width: 3rem; /* 移动端更小的固定宽度 */
  }
  
  .vs-container {
    padding: 0 0.5rem;
  }
  
  .player-card .flex.items-center.gap-3 {
    gap: 0.75rem;
  }
  
  .player-card h4 {
    font-size: 1rem;
  }
  
  .player-card p {
    font-size: 0.75rem;
  }
}

/* 确保背景始终为白色 */
.predict-battle-container {
  background-color: #f8f9fa !important;
}

/* 文本截断样式 */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: calc(1.4em * 3);
}

.line-clamp-5 {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: calc(1.4em * 5);
}

/* 卡片高度一致性 */
.battle-player-card {
  display: flex;
  flex-direction: column;
}

.player-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 预测文字区域样式 */
.prediction-text {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  padding: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #3b3b3b;
  flex: 1;
  display: flex;
  align-items: flex-start;
}

/* 支持按钮样式 */
.support-btn-small {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border: 1px solid;
}

.support-btn-small:hover {
  transform: scale(1.1);
}

/* Winner标识样式 */
.winner-overlay {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  background: #34C759;
  border-radius: 50%;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.winner-overlay img {
  width: 0.75rem;
  height: 0.75rem;
}

/* 已结束对战的样式 */
.player-card.ended {
  opacity: 0.8;
  filter: grayscale(0.3);
}

/* 胜利者样式 */
.winner-badge {
  background: linear-gradient(135deg, #34C759 0%, #30A46C 100%);
  box-shadow: 0 4px 12px rgba(52, 199, 89, 0.3);
  animation: winnerGlow 2s ease-in-out infinite alternate;
}

@keyframes winnerGlow {
  0% {
    box-shadow: 0 4px 12px rgba(52, 199, 89, 0.3);
  }
  100% {
    box-shadow: 0 6px 20px rgba(52, 199, 89, 0.5);
  }
}

/* 已结束状态样式 */
.ended-badge {
  background: linear-gradient(135deg, #6F6F6F 0%, #5A5A5A 100%);
  opacity: 0.8;
}

/* 加载动画 */
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.player-card.loading {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}

/* 成功状态动画 */
@keyframes successPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(52, 199, 89, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
  }
}

.support-btn.success {
  animation: successPulse 0.6s ease-out;
}

/* 自定义滚动条 */
.predict-battle-container::-webkit-scrollbar {
  width: 6px;
}

.predict-battle-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.predict-battle-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.predict-battle-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>
