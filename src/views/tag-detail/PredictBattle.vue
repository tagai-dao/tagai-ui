<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { getPredictBattleData, tweet } from '@/apis/api'
import { GlobalModalType, type BattleData, type Tweet } from '@/types'
import { formatAmount, parseTimestamp, getDayNumber } from '@/utils/helper'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip } from '@/utils/notify'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import TweetBtnCurate from '@/components/tweets/TweetBtnCurate.vue'
import TweetBtnReply from '@/components/tweets/TweetBtnReply.vue'
import { useRouter } from 'vue-router'
import { useModalStore } from '@/stores/common'
import emitter from '@/utils/emitter'
import { getMarketInfos } from '@/utils/fpmm'

const comStore = useCommunityStore()
const accStore = useAccountStore()
const battles = ref<BattleData[]>([])
const router = useRouter()
let tweets = reactive<{ [key: string]: Tweet }>({})

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const showCreateTweetModal = ref(false)

const onRefresh = async () => {
    try {
        if (refreshing.value) return
        refreshing.value = true
        const data: any = await getPredictBattleData(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId)

        if (data.battle && data.battle.length > 0) {
          const marketInfos = await getMarketInfos(data.battle as BattleData[])
          console.log(344, marketInfos)
            tweets = Object.assign({}, data.tweets)
            battles.value = (data.battle as BattleData[]).map(battle => ({
                ...battle,
                winner: getWinner(battle),
                reserveA: marketInfos[battle.marketMaker + '-priceA'],
                reserveB: marketInfos[battle.marketMaker + '-priceB'],
                fee: marketInfos[battle.marketMaker + '-fee']
            }))
            console.log(44, tweets, data, battles.value)
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
      console.log(33, tweetA.isSettled, tweetB.isSettled)
        if (tweetA.isSettled && tweetB.isSettled) {
            return (tweetA.amount ?? 0) > (tweetB.amount ?? 0) ? 'left' : 'right'
        }
        return null
    }
    return null
}

const getBattleStats = (battle: BattleData) => {
  const amountA = battle.reserveB || 0
  const amountB = battle.reserveA || 0
  const total = amountA + amountB
  
  if (total === 0) return { percentA: 50, percentB: 50 }
  
  const percentA = Math.round((amountA / total) * 100)
  const percentB = 100 - percentA
  
  return { percentA, percentB }
}

const openTweet = (tweetId: string) => {
  router.push(`/post-detail/${tweetId}`)
}

const openTradeModal = (battle: BattleData) => {
  useModalStore().setModalVisible(true, GlobalModalType.PredictTrade, { battle, tweets })
}

const createPredictBattle = () => {
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
        <span class="text-2xl">+</span>
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
      <div v-else
        v-for="battle in battles"
        :key="battle.predictAID + battle.predictBID"
        class="battle-card bg-white rounded-2xl p-2 sm:p-4 shadow-sm border mb-3 border-grey-light"
      >
        <!-- 卡片头部 -->
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-semibold text-black flex-1 pr-2">
            {{ battle.title }}
          </h3>
          <!-- 倒计时/状态 -->
          <div class="flex flex-col items-end">
            <div
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="{
                'bg-green-light text-green-dark': !battle.winner,
                'bg-grey-light text-grey-normal': !!battle.winner,
              }"
            >
              {{ battle.winner ? $t('ended') : parseTimestamp((Math.max(tweets[battle.predictAID]?.dayNumber, tweets[battle.predictBID]?.dayNumber, getDayNumber()) + 3) * 86400000) }}
            </div>
          </div>
        </div>

        <!-- 对战双方 -->
        <div class="flex items-stretch gap-3 sm:gap-8 relative overflow-hidden rounded-xl sm:rounded-2xl border-2 pb-24 sm:pb-32"
          :class="{
            'bg-gray-50 border-gray-200': !battle.winner,
            'bg-gradient-to-br from-grey-light to-grey-light-hover border-grey-normal/20': !!battle.winner
          }"
        >
          <!-- Trade 按钮 (absolute定位到底部中间) -->
          <div class="absolute bottom-4 sm:bottom-6 left-0 right-0 flex flex-col items-center justify-center z-20 pointer-events-none">
            <button 
              class="pointer-events-auto w-1/2 h-9 sm:h-10 bg-gradient-primary text-white text-xs sm:text-sm font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center"
              @click="openTradeModal(battle)"
            >
              Trade
            </button>
            <!-- <p class="text-xs text-grey-normal mt-1 text-center">
              {{ 'Current fee: ' + (battle.fee ? battle.fee * 100 : 0).toFixed(2) + '%' }}
            </p> -->
          </div>

          <!-- 统一的进度条 (absolute定位到底部) -->
          <div class="absolute bottom-20 sm:bottom-24 left-4 right-4 flex flex-col gap-2 z-10">
            <!-- 进度条行 -->
            <div class="flex items-center gap-3">
              <!-- 左侧比例 -->
              <span class="text-xs font-bold text-red-normal min-w-[2.5rem] text-right">{{ getBattleStats(battle).percentA }}%</span>
              
              <!-- 进度条主体 -->
              <div class="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex relative">
                 <!-- 左侧红色条 -->
                <div 
                  class="h-full bg-red-normal transition-all duration-500 flex items-center justify-end pr-2" 
                  :style="{ width: getBattleStats(battle).percentA + '%' }"
                >
                </div>
                <!-- 右侧蓝色条 -->
                <div 
                  class="h-full bg-blue-600 transition-all duration-500 flex items-center justify-start pl-2" 
                  :style="{ width: getBattleStats(battle).percentB + '%' }"
                >
                </div>
              </div>
              
              <!-- 右侧比例 -->
              <span class="text-xs font-bold text-blue-600 min-w-[2.5rem]">{{ getBattleStats(battle).percentB }}%</span>
            </div>

            <!-- VOL 行 -->
            <!-- <div class="flex justify-between text-[10px] sm:text-xs font-medium text-gray-500 px-[3.25rem]">
              <div class="flex items-center gap-1">
                <span>VOL:</span>
                <span>{{ formatAmount(tweets[battle.predictAID]?.amount ?? 0) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span>VOL:</span>
                <span>{{ formatAmount(tweets[battle.predictBID]?.amount ?? 0) }}</span>
              </div>
            </div> -->
          </div>

          <!-- 左侧玩家卡片 -->
          <div class="flex-1 overflow-hidden battle-player-card">
            <div
                class="player-card p-2 sm:p-4 relative flex flex-col gap-1 sm:gap-3"
            >
              <!-- 主要内容区域 -->
              <div class="flex-1 flex flex-col sm:flex-row gap-1 sm:gap-2">
                <!-- 左侧：头像、用户名和支持按钮 -->
                <div class="flex flex-row sm:flex-col items-center gap-2 w-full sm:w-1/3 sm:min-w-1/3 sm:max-w-1/3">
                  <div class="relative">
                    <UserAvatar
                      :profile-img="tweets[battle.predictAID]?.profile"
                      :name="tweets[battle.predictAID]?.twitterName"
                      :username="tweets[battle.predictAID]?.twitterUsername"
                      :followers="tweets[battle.predictAID]?.followers"
                      :followings="tweets[battle.predictAID]?.followings"
                      :credit="tweets[battle.predictAID]?.credit"
                      :steem-id="tweets[battle.predictAID]?.steemId"
                      :eth-addr="tweets[battle.predictAID]?.ethAddr"
                      :teleported="true"
                    >
                      <template #avatar-img>
                        <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 sm:border-3 border-red-normal shadow-md">
                          <img
                            v-if="tweets[battle.predictAID]?.profile"
                            :src="tweets[battle.predictAID]?.profile"
                            :alt="tweets[battle.predictAID]?.twitterName"
                            class="w-full h-full object-cover"
                          >
                          <div v-else class="w-full h-full bg-red-normal flex items-center justify-center">
                            <i-ep-avatar class="text-white text-sm sm:text-2xl" />
                          </div>
                        </div>
                      </template>
                    </UserAvatar>

                    <!-- Winner 标识 -->
                    <div
                      v-if="battle.winner && battle.winner === 'left'"
                      class="absolute -top-2 -left-2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg"
                    >
                      <img src="~@/assets/icons/icon-winner.svg" alt="Winner" class="w-5 h-5 sm:w-6 sm:h-6 -rotate-45" />
                    </div>
                  </div>

                  <!-- 用户名 -->
                  <p class="text-sm font-bold text-red-normal leading-tight w-full break-words text-center">
                    {{ tweets[battle.predictAID]?.twitterUsername }}
                  </p>
                  <!-- <p class="text-sm text-red-normal leading-tight w-full break-words text-center">
                    {{ formatAmount(tweets[battle.predictAID]?.credit ?? 0) }}
                  </p> -->
                </div>

                <!-- 左侧：预测文字 -->
                <div class="flex-1 overflow-hidden" @click="openTweet(battle.predictAID)">
                  <div class="w-full text-sm sm:text-base text-grey-normal leading-relaxed h-full">
                    <div class="line-clamp-5 min-h-[84px]" :title="tweets[battle.predictAID]?.content ?? ''">
                      {{ tweets[battle.predictAID]?.content ?? '' }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-stretch gap-3">
                <div class="flex-1 flex flex-col gap-1 items-center">
                  <!-- <button
                      v-if="!battle.winner"
                      @click="getWinner(battle)"
                      class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"

                  >
                    <i class="w-4 h-4 sm:w-6 sm:h-6 " :class="tweets[battle.predictAID]?.liked ? 'btn-icon-reply-active-red' : 'btn-icon-reply'"></i>
                  </button> -->
                  <TweetBtnReply :tweet="tweets[battle.predictAID]" :hide-number="true" />
                  <div class="text-xs sm:text-sm text-red-600 text-center flex flex-col items-center">
                    <span>{{ tweets[battle.predictAID]?.replyCount ?? 0 }}</span>
                    <span class="text-xs">{{ $t('postView.comments') }}</span>
                  </div>
                </div>
                <!-- 支持按钮 -->
                <div class="flex-1 flex flex-col gap-1 items-center">
                  <!-- <button
                      v-if="!battle.winner"
                      @click="null"
                      class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"

                  >
                    <i class="w-full h-full" :class="tweets[battle.predictAID]?.liked ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                  </button> -->
                  <TweetBtnCurate :tweet="tweets[battle.predictAID]" :hide-number="true" />
                  <div class="text-xs sm:text-sm text-red-600 text-center flex flex-col items-center">
                   <span> {{ (Math.ceil(tweets[battle.predictAID]?.amount ?? 0)).toLocaleString() }}</span>
                    <span class="text-xs">{{ $t('curation.supports') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- VS 标识 -->
          <div class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center
                      w-6 min-w-6 sm:w-10 sm:min-w-10  flex-shrink-0 z-50">
            <div class="vs-indicator relative">
                <img src="~@/assets/icons/icon-pk.png" alt="">
          </div>
          </div>

          <!-- 右侧玩家卡片 -->
          <div class="flex-1 overflow-hidden battle-player-card">
            <div
                class="player-card p-2 sm:p-4 relative flex flex-col gap-1 sm:gap-3"
            >
              <!-- 主要内容区域 -->
              <div class="flex-1 flex flex-col-reverse sm:flex-row gap-1 sm:gap-2">
                <!-- 左侧：预测文字 -->
                <div class="flex-1 overflow-hidden" @click="openTweet(battle.predictBID)">
                  <div class="w-full text-sm sm:text-base text-grey-normal leading-relaxed h-full text-right">
                    <div class="line-clamp-5 min-h-[84px]" :title="tweets[battle.predictBID]?.content ?? ''">
                      {{ tweets[battle.predictBID]?.content ?? '' }}
                    </div>
                  </div>
                </div>

                <!-- 右侧：头像、用户名和支持按钮 -->
                <div class="flex flex-row sm:flex-col items-center gap-2 w-full sm:w-1/3 sm:min-w-1/3 sm:max-w-1/3">
                  <div class="relative">
                    <UserAvatar
                      :profile-img="tweets[battle.predictBID]?.profile"
                      :name="tweets[battle.predictBID]?.twitterName"
                      :username="tweets[battle.predictBID]?.twitterUsername"
                      :followers="tweets[battle.predictBID]?.followers"
                      :followings="tweets[battle.predictBID]?.followings"
                      :credit="tweets[battle.predictBID]?.credit ?? 0"
                      :steem-id="tweets[battle.predictBID]?.steemId"
                      :eth-addr="tweets[battle.predictBID]?.ethAddr"
                      :teleported="true"
                    >
                      <template #avatar-img>
                        <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 sm:border-3 border-blue-600 shadow-md">
                          <img
                            v-if="tweets[battle.predictBID]?.profile"
                            :src="tweets[battle.predictBID]?.profile"
                            :alt="tweets[battle.predictBID]?.twitterName"
                            class="w-full h-full object-cover"
                          >
                          <div v-else class="w-full h-full bg-blue-600 flex items-center justify-center">
                            <i-ep-avatar class="text-white text-lg sm:text-2xl" />
                          </div>
                        </div>
                      </template>
                    </UserAvatar>

                    <!-- Winner 标识 -->
                    <div
                      v-if="battle.winner && battle.winner == 'right'"
                      class="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg"
                    >
                      <img src="~@/assets/icons/icon-winner.svg" alt="Winner" class="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                    </div>
                  </div>

                  <!-- 用户名 -->
                  <p class="text-sm font-bold text-blue-600 leading-tight w-full break-words text-center">
                    {{ tweets[battle.predictBID]?.twitterUsername }}
                  </p>
                  <!-- <p class="text-sm text-blue-600 leading-tight w-full break-words text-left">
                    {{ formatAmount(Math.ceil(tweets[battle.predictBID]?.credit ?? 0)) }}
                  </p> -->
                </div>
              </div>
              <div class="flex items-stretch gap-3">
                <!-- 评论按钮 -->
                <div class="flex-1 flex flex-col gap-1 items-center">
                  <!-- <button
                      v-if="!battle.winner"
                      class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"
                      :class="{
                      'bg-blue-600 text-white shadow-lg': tweets[battle.predictBID]?.liked,
                      'bg-white text-blue-600 border border-blue-600 hover:bg-blue-600 hover:text-white': !tweets[battle.predictBID]?.liked
                    }"
                  >
                    <i class="w-2.5 h-2.5 sm:w-3 sm:h-3" :class="tweets[battle.predictAID]?.liked ? 'btn-icon-reply-active-red' : 'btn-icon-reply'"></i>
                  </button> -->
                  <TweetBtnReply :tweet="tweets[battle.predictBID]" :hide-number="true" />
                  <div class="text-xs sm:text-sm text-blue-600 text-center flex flex-col items-center">
                    <span>{{ tweets[battle.predictBID]?.replyCount ?? 0 }}</span> <span class="text-xs">{{ $t('postView.comments') }}</span>
                  </div>
                </div>
                <!-- 支持按钮 -->
                <div class="flex-1 flex flex-col gap-1 items-center">
                  <!-- <button
                      v-if="!battle.winner"
                      @click="null"
                      class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"
                      :class="{
                      'bg-blue-600 text-white shadow-lg': tweets[battle.predictBID]?.liked,
                      'bg-white text-blue-600 border border-blue-600 hover:bg-blue-600 hover:text-white': !tweets[battle.predictBID]?.liked
                    }"
                  >
                    <i class="w-3 h-3 sm:w-4 sm:h-4" :class="tweets[battle.predictBID]?.liked ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                  </button> -->
                  <TweetBtnCurate :tweet="tweets[battle.predictBID]" :hide-number="true" />
                  <div class="text-xs sm:text-sm text-blue-600 text-center flex flex-col items-center">
                    <span>{{ (Math.ceil(tweets[battle.predictBID]?.amount ?? 0)).toLocaleString() }}</span> <span class="text-xs">{{ $t('curation.supports') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
