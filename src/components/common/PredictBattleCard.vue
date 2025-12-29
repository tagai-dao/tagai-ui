<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import type { BattleData, Tweet } from '@/types'
import { formatAmount, parseTimestamp } from '@/utils/helper';
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useRouter } from 'vue-router';
import { usePredict } from '@/composables/usePredict';
import { getBuyData } from '@/utils/fpmm';
import debounce from 'lodash.debounce';

const props = defineProps<{
    battle: BattleData,
    tweets: { [key: string]: Tweet },
    showCommunity?: boolean
}>()
const router = useRouter();
const accStore = useAccountStore();
const { percentA, percentB } = usePredict(props.battle);
// 购买状态管理
const showBuyInput = ref(false);
const selectedColor = ref<'red' | 'blue' | null>(null);
const buyAmount = ref('');
const willReceiveAmount = ref(0);
const calculatingAmount = ref(false);

const aAmount = computed(() => {
  return props.tweets[props.battle.predictAID]?.amount ?? 0
})
const bAmount = computed(() => {
  return props.tweets[props.battle.predictBID]?.amount ?? 0
})

const totalCuration = computed(() => {
  return aAmount.value + bAmount.value
})

const openTweet = () => {
  router.push(`/predict-detail/${props.battle.marketMaker}`)
}

const openTradeModal = () => {
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  useModalStore().setModalVisible(true, GlobalModalType.PredictTrade, { battle: props.battle, tweets: props.tweets as { [key: string]: Tweet } })
}

const openLiquidityModal = () => {
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  useModalStore().setModalVisible(true, GlobalModalType.PredictLiquidity, { battle: props.battle, tweets: props.tweets as { [key: string]: Tweet } })
}

const openCommunity = (tick: string) => {
  router.push(`/tag-detail/${tick}`)
}

// 购买红色按钮
const buyRed = () => {
  if (props.battle.status !== 1) return;

  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }else {
    selectedColor.value = 'red';
    showBuyInput.value = true;
    buyAmount.value = '';
  }
}

// 购买蓝色按钮
const buyBlue = () => {
  if (props.battle.status !== 1) return;
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }else {
    selectedColor.value = 'blue';
    showBuyInput.value = true;
    buyAmount.value = '';
  }
}

// 关闭购买输入
const closeBuyInput = () => {
  showBuyInput.value = false;
  selectedColor.value = null;
  buyAmount.value = '';
  willReceiveAmount.value = 0;
}

// 计算获得的代币数量
const calculateReceiveAmount = debounce(async () => {
  if (!buyAmount.value || parseFloat(buyAmount.value) <= 0 || !selectedColor.value) {
    willReceiveAmount.value = 0;
    return;
  }
  try {
    calculatingAmount.value = true;
    const result = await getBuyData(props.battle, parseFloat(buyAmount.value), selectedColor.value);
    if (result && typeof result === 'object' && 'amount' in result) {
      willReceiveAmount.value = result.amount || 0;
    } else {
      willReceiveAmount.value = 0;
    }
  } catch (error) {
    console.error('计算获得代币数量失败:', error);
    willReceiveAmount.value = 0;
  } finally {
    calculatingAmount.value = false;
  }
}, 500);

// 监听购买金额变化，自动计算获得的代币数量
watch([buyAmount, selectedColor], () => {
  if (showBuyInput.value && selectedColor.value) {
    calculateReceiveAmount();
  }
});

// 确认购买（功能待实现）
const confirmBuy = () => {
  // TODO: 实现购买功能
  console.log(`购买 ${selectedColor.value}，数量: ${buyAmount.value}`);
  try {
    
  } catch (error) {
    
  }
  // 购买成功后关闭输入框
  closeBuyInput();
}

</script>

<template>
    <div @click="openTweet()" class="battle-card bg-white rounded-2xl p-2 sm:p-4 shadow-sm border mb-3 border-grey-light"
      >
        <!-- 卡片头部 -->
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-semibold text-black flex-1 pr-2">
            {{ battle.title }}
            <span v-if="showCommunity" class="cursor-pointer" @click.stop="openCommunity(battle.tick)">
              (@<span class="text-blue-600 underline">{{ battle.tick }}</span>)
            </span>
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
              {{ battle.winner ? $t('ended') : parseTimestamp((Math.max(tweets[battle.predictAID]?.dayNumber, tweets[battle.predictBID]?.dayNumber) + 3) * 86400000) }}
            </div>
          </div>
        </div>

        <!-- 对战双方 - 上下布局 -->
        <div class="flex flex-col gap-3 sm:gap-4 relative overflow-hidden rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4"
          :class="{
            'bg-gray-50 border-gray-200': !battle.winner,
            'bg-gradient-to-br from-grey-light to-grey-light-hover border-grey-normal/20': !!battle.winner
          }"
        >
          <!-- 上方推文卡片（红色） -->
          <div class="flex items-stretch gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg border border-red-normal/20 bg-white/50">
            <!-- 左侧：头像和用户名 -->
            <div class="flex flex-col items-center gap-2 flex-shrink-0 w-20 sm:w-24">
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
                    <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-red-normal shadow-md">
                      <img
                        v-if="tweets[battle.predictAID]?.profile"
                        :src="tweets[battle.predictAID]?.profile"
                        :alt="tweets[battle.predictAID]?.twitterName"
                        class="w-full h-full object-cover"
                      >
                      <div v-else class="w-full h-full bg-red-normal flex items-center justify-center">
                        <i-ep-avatar class="text-white text-lg sm:text-2xl" />
                      </div>
                    </div>
                  </template>
                </UserAvatar>

                <!-- Winner 标识 -->
                <div
                  v-if="battle.winner && battle.winner === 'left'"
                  class="absolute top-0 right-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg z-10"
                  style="transform: translate(40%, -40%);"
                >
                  <img src="~@/assets/icons/icon-winner.svg" alt="Winner" class="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                </div>
              </div>
              <p class="text-xs sm:text-sm font-bold text-red-normal leading-tight break-words text-center max-w-[80px]">
                {{ tweets[battle.predictAID]?.twitterUsername }}
              </p>
            </div>

            <!-- 中间：推文内容 -->
            <div class="flex-1 overflow-hidden min-w-0">
              <div class="text-sm sm:text-base text-grey-normal leading-relaxed">
                <div class="line-clamp-3 sm:line-clamp-4" :title="tweets[battle.predictAID]?.content ?? ''">
                  {{ tweets[battle.predictAID]?.content ?? '' }}
                </div>
              </div>
            </div>

            <!-- 右侧：支持按钮（点火按钮） -->
              <TweetBtnCurate ref="curateBtnARef" 
              :tweet="tweets[battle.predictAID]" 
              :hide-number="true" 
              :btnclass="`flex flex-col text-red-600 items-center justify-center gap-1 flex-shrink-0 self-stretch square-button border-2 border-red-normal rounded-lg px-2 py-3 w-16 sm:w-20 cursor-pointer hover:opacity-90 transition-opacity`">
                <template #number class="flex flex-col gap-1 items-center justify-center">
                  {{ totalCuration ? (aAmount / totalCuration * 100).toFixed(2) : '50' }}%
                  <span>({{ aAmount.toFixed(0).toLocaleString() }})</span>
                </template>
              </TweetBtnCurate>
          </div>

          <!-- 下方推文卡片（蓝色） -->
          <div class="flex items-stretch gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg border border-blue-600/20 bg-white/50">
            <!-- 左侧：头像和用户名 -->
            <div class="flex flex-col items-center gap-2 flex-shrink-0 w-20 sm:w-24">
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
                    <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-blue-600 shadow-md">
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
                  v-if="battle.winner && battle.winner === 'right'"
                  class="absolute top-0 right-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg z-10"
                  style="transform: translate(40%, -40%);"
                >
                  <img src="~@/assets/icons/icon-winner.svg" alt="Winner" class="w-5 h-5 sm:w-6 sm:h-6 rotate-45" />
                </div>
              </div>
              <p class="text-xs sm:text-sm font-bold text-blue-600 leading-tight break-words text-center max-w-[80px]">
                {{ tweets[battle.predictBID]?.twitterUsername }}
              </p>
            </div>

            <!-- 中间：推文内容 -->
            <div class="flex-1 overflow-hidden min-w-0">
              <div class="text-sm sm:text-base text-grey-normal leading-relaxed">
                <div class="line-clamp-3 sm:line-clamp-4" :title="tweets[battle.predictBID]?.content ?? ''">
                  {{ tweets[battle.predictBID]?.content ?? '' }}
                </div>
              </div>
            </div>

            <!-- 右侧：支持按钮（点火按钮） -->
            <TweetBtnCurate ref="curateBtnBRef" 
            :tweet="tweets[battle.predictBID]" 
            :hide-number="true" 
            :btnclass="`flex flex-col items-center text-blue-600 justify-center gap-1 flex-shrink-0 self-stretch square-button border-2 border-blue-600 rounded-lg px-2 py-3 w-16 sm:w-20 cursor-pointer hover:opacity-90 transition-opacity`">
              <template #number>
                {{ totalCuration ? (bAmount / totalCuration * 100).toFixed(2) : '50' }}%
                <span>({{ bAmount.toFixed(0).toLocaleString() }})</span>
              </template>
            </TweetBtnCurate>
          </div>

          <!-- 底部：购买按钮区域 -->
          <div class="flex gap-3 sm:gap-4 mt-2" @click.stop>
            <Transition name="buy-buttons" mode="out-in">
              <!-- 默认状态：两个购买按钮 -->
              <div v-if="!showBuyInput" key="buttons" class="flex gap-3 sm:gap-4 w-full">
                <button 
                  class="flex-1 h-10 sm:h-12 bg-red-normal text-white text-sm sm:text-base font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center"
                  @click="buyRed()"
                  :disabled="battle.status !== 1 || (tweets[battle.predictAID]?.dayNumber + 3) * 86400000 < Date.now()"
                >
                  {{ $t('predictTrade.buyRed') || '购买红色' }}
                 ({{ percentA.toFixed(2) }})
                </button>
                <button 
                  class="flex-1 h-10 sm:h-12 bg-blue-600 text-white text-sm sm:text-base font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center"
                  @click="buyBlue()"
                  :disabled="battle.status !== 1 || (tweets[battle.predictBID]?.dayNumber + 3) * 86400000 < Date.now()"
                >
                  {{ $t('predictTrade.buyBlue') || '购买蓝色' }}
                  ({{ percentB.toFixed(2) }})
                </button>
              </div>
              
              <!-- 输入状态：输入框、购买按钮、关闭按钮 -->
              <div v-else key="input" class="flex gap-2 sm:gap-3 w-full items-center">
                <input
                  v-model="buyAmount"
                  type="number"
                  :placeholder="$t('predictTrade.intputTokenAmount', { tick: battle.tick })"
                  class="flex-1 h-14 sm:h-16 px-3 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all"
                  :class="selectedColor === 'red' ? 'border-red-normal focus:ring-red-normal' : 'border-blue-600 focus:ring-blue-600'"
                  @keyup.enter="confirmBuy"
                />
                <button
                  @click="confirmBuy()"
                  class="h-14 sm:h-16 px-4 sm:px-6 text-sm sm:text-base font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center text-white"
                  :class="selectedColor === 'red' ? 'bg-red-normal' : 'bg-blue-600'"
                  :disabled="!buyAmount || parseFloat(buyAmount) <= 0 || calculatingAmount"
                >
                  <span>{{ $t('buy') || '购买' }}</span>
                  <span v-if="willReceiveAmount > 0" class="text-xs opacity-90 mt-0.5">
                   {{ $t('predictTrade.getResult', {
                      amount: formatAmount(willReceiveAmount), 
                      result: selectedColor === 'red' ? $t('predictTrade.red') : $t('predictTrade.blue')
                    }) }}
                  </span>
                  <span v-else-if="calculatingAmount" class="text-xs opacity-90 mt-0.5">
                    {{ $t('predictTrade.calculating') }}
                  </span>
                </button>
                <button
                  @click="closeBuyInput()"
                  class="h-6 sm:h-8 w-8 sm:w-10 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 active:scale-[0.98] transition-all duration-200"
                  title="关闭"
                >
                  <i-ep-close class="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </Transition>
          </div>
        </div>
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
    
    /* 正方形按钮样式 - 高度等于推文高度，宽度固定 */
    .square-button {
      /* 宽度已通过 w-16 sm:w-20 设置，高度通过 self-stretch 拉伸 */
      min-width: 0; /* 允许在 flex 容器中正确计算 */
    }
    
    /* 购买按钮动画 */
    .buy-buttons-enter-active,
    .buy-buttons-leave-active {
      transition: all 0.3s ease;
    }
    
    .buy-buttons-enter-from {
      opacity: 0;
      transform: translateY(-10px) scale(0.9);
    }
    
    .buy-buttons-leave-to {
      opacity: 0;
      transform: translateY(10px) scale(0.9);
    }
    
    .buy-buttons-move {
      transition: transform 0.3s ease;
    }
    </style>
    