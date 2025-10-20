<script setup lang="ts">
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import UserAvatar from '@/components/common/UserAvatar.vue'

dayjs.extend(relativeTime)

// 对战数据类型定义
interface BattleData {
  id: string
  title: string
  leftPlayer: {
    id: string
    name: string
    username: string
    avatar: string
    supporters: number
    isSupported?: boolean
    prediction?: string
  }
  rightPlayer: {
    id: string
    name: string
    username: string
    avatar: string
    supporters: number
    isSupported?: boolean
    prediction?: string
  }
  endTime: number
  status: 'ongoing' | 'ended' | 'upcoming'
}

// 模拟数据
const battles = ref<BattleData[]>([
  {
    id: '1',
    title: '2024年加密货币市场预测',
    leftPlayer: {
      id: '1',
      name: 'CryptoExpert',
      username: 'crypto_expert',
      avatar: '',
      supporters: 1247,
      prediction: '比特币将在2024年突破10万美元，加密货币市场将迎来新的牛市周期。机构投资者的大规模入场将推动价格持续上涨。'
    },
    rightPlayer: {
      id: '2', 
      name: 'MarketAnalyst',
      username: 'market_analyst',
      avatar: '',
      supporters: 892,
      prediction: '加密货币市场将面临监管压力，价格可能回调至较低水平。传统金融市场的波动将影响数字资产的表现。'
    },
    endTime: Date.now() + 2 * 60 * 60 * 1000, // 2小时后结束
    status: 'ongoing'
  },
  {
    id: '2',
    title: 'AI vs 传统编程的未来',
    leftPlayer: {
      id: '3',
      name: 'AIPioneer',
      username: 'ai_pioneer',
      avatar: '',
      supporters: 2156,
      prediction: 'AI编程工具将彻底改变软件开发行业，传统编程技能将变得不再重要。AI将能够独立完成大部分编程任务。'
    },
    rightPlayer: {
      id: '4',
      name: 'ClassicDev',
      username: 'classic_dev',
      avatar: '',
      supporters: 1834,
      prediction: '传统编程技能仍然不可或缺，AI只是辅助工具。程序员的逻辑思维和问题解决能力是AI无法替代的。'
    },
    endTime: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5天后结束
    status: 'ongoing'
  },
  {
    id: '3',
    title: 'Web3 vs Web2 用户体验',
    leftPlayer: {
      id: '5',
      name: 'Web3Builder',
      username: 'web3_builder',
      avatar: '',
      supporters: 987,
      prediction: 'Web3的用户体验将超越Web2，去中心化应用将成为主流。用户将更愿意使用拥有数据主权的应用。'
    },
    rightPlayer: {
      id: '6',
      name: 'Web2Designer',
      username: 'web2_designer',
      avatar: '',
      supporters: 1456,
      prediction: 'Web2的用户体验仍然更优秀，中心化服务能提供更好的性能和便利性。Web3的复杂性阻碍了大规模采用。'
    },
    endTime: Date.now() - 24 * 60 * 60 * 1000, // 已结束
    status: 'ended'
  }
])

// 格式化倒计时
const formatCountdown = (endTime: number) => {
  const now = Date.now()
  const diff = endTime - now
  
  if (diff <= 0) {
    return '已结束'
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    return `${days}天${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

// 支持功能
const supportPlayer = (battleId: string, playerId: string) => {
  const battle = battles.value.find(b => b.id === battleId)
  if (!battle || battle.status === 'ended') return // 已结束的对战不能支持
  
  // 取消之前的支持
  if (battle.leftPlayer.isSupported) {
    battle.leftPlayer.isSupported = false
    battle.leftPlayer.supporters -= 1
  }
  if (battle.rightPlayer.isSupported) {
    battle.rightPlayer.isSupported = false
    battle.rightPlayer.supporters -= 1
  }
  
  // 设置新的支持
  if (playerId === battle.leftPlayer.id) {
    battle.leftPlayer.isSupported = true
    battle.leftPlayer.supporters += 1
  } else if (playerId === battle.rightPlayer.id) {
    battle.rightPlayer.isSupported = true
    battle.rightPlayer.supporters += 1
  }
}

// 判断胜利者
const getWinner = (battle: BattleData) => {
  if (battle.status !== 'ended') return null
  if (battle.leftPlayer.supporters > battle.rightPlayer.supporters) {
    return 'left'
  } else if (battle.rightPlayer.supporters > battle.leftPlayer.supporters) {
    return 'right'
  }
  return 'tie' // 平局
}

// 格式化支持者数量
const formatSupporters = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}
</script>

<template>
  <div class="predict-battle-container rounded-t-2xl overflow-hidden">
    <!-- 页面标题 -->
    <div class="px-4 py-3 bg-white mb-2 sm:mb-4">
      <h2 class="text-h3 text-black font-bold">预测对战</h2>
      <p class="text-sm text-grey-normal mt-1">支持你认同的观点，参与社区讨论</p>
    </div>

    <!-- 对战列表 -->
    <div class="px-2 sm:px-4 pb-4 space-y-4">
      <div
        v-for="battle in battles"
        :key="battle.id"
        class="battle-card bg-white rounded-2xl p-2 sm:p-4 shadow-sm border border-grey-light"
      >
        <!-- 卡片头部 -->
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-base font-semibold text-black flex-1 pr-2">
            {{ battle.title }}
          </h3>
          <!-- 倒计时/状态 -->
          <div class="flex flex-col items-end">
            <div
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="{
                'bg-green-light text-green-dark': battle.status === 'ongoing',
                'bg-grey-light text-grey-normal': battle.status === 'ended',
                'bg-orange-light text-orange-normal': battle.status === 'upcoming'
              }"
            >
              {{ battle.status === 'ended' ? '已结束' : formatCountdown(battle.endTime) }}
            </div>
          </div>
        </div>

        <!-- 对战双方 -->
        <div class="flex items-center gap-2 sm:gap-6 relative overflow-hidden">
          <!-- 左侧玩家卡片 -->
          <div class="flex-1 overflow-hidden battle-player-card -z-[1]">
            <div
                class="player-card rounded-xl sm:rounded-2xl p-2 sm:p-4 border-2 shadow-lg relative h-full min-h-[180px] sm:min-h-[200px] flex flex-col"
              :class="{
                'bg-gradient-to-br from-red-light to-red-light-hover border-red-normal/20': battle.status !== 'ended',
                'bg-gradient-to-br from-grey-light to-grey-light-hover border-grey-normal/20': battle.status === 'ended'
              }"
            >
              <!-- 主要内容区域 -->
              <div class="flex-1 flex flex-col sm:flex-row gap-1 sm:gap-2">
                <!-- 左侧：头像、用户名和支持按钮 -->
                <div class="flex flex-row sm:flex-col items-center gap-2 w-1/3 min-w-1/3">
                  <div class="relative">
                    <UserAvatar
                      :profile-img="battle.leftPlayer.avatar"
                      :name="battle.leftPlayer.name"
                      :username="battle.leftPlayer.username"
                      :followers="0"
                      :followings="0"
                      :credit="0"
                      :steem-id="null"
                      :eth-addr="null"
                      :teleported="false"
                    >
                      <template #avatar-img>
                        <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 sm:border-3 border-red-normal shadow-md">
                          <img
                            v-if="battle.leftPlayer.avatar"
                            :src="battle.leftPlayer.avatar"
                            :alt="battle.leftPlayer.name"
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
                      v-if="battle.status === 'ended' && getWinner(battle) === 'left'"
                      class="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-34 rounded-full border-2 border-white flex items-center justify-center shadow-lg"
                    >
                      <img src="~@/assets/icons/icon-pk.png" alt="Winner" class="w-2 h-2 sm:w-3 sm:h-3" />
                    </div>
                  </div>

                  <!-- 用户名 -->
                  <div class="text-center flex flex-col items-center justify-center">
                    <p class="text-sm font-bold text-red-normal leading-tight break-words">
                      {{ battle.leftPlayer.name }}
                    </p>
                    <p class="text-sm text-red-normal/70">
                      {{ formatSupporters(battle.leftPlayer.supporters) }} 支持
                    </p>
                  </div>

                  <!-- 支持按钮 -->
                  <button
                    v-if="battle.status !== 'ended'"
                    @click="supportPlayer(battle.id, battle.leftPlayer.id)"
                    class="hidden sm:w-8 sm:h-8 rounded-full sm:flex items-center justify-center transition-all duration-200"

                  >
                    <i class="w-full h-full" :class="battle.leftPlayer.isSupported ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                  </button>
                </div>

                <!-- 右侧：预测文字 -->
                <div class="flex-1">
                  <div class="text-sm sm:text-base text-grey-normal leading-relaxed h-full">
                    <div class="line-clamp-5">
                      {{ battle.leftPlayer.prediction }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-center sm:hidden">
                <!-- 支持按钮 -->
                <button
                    v-if="battle.status !== 'ended'"
                    @click="supportPlayer(battle.id, battle.leftPlayer.id)"
                    class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"

                >
                  <i class="w-full h-full" :class="battle.leftPlayer.isSupported ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- VS 标识 -->
          <div class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center
                      w-6 min-w-6 sm:w-10 sm:min-w-10  flex-shrink-0 z-99">
            <div class="vs-indicator relative">
                <img src="~@/assets/icons/icon-pk.png" alt="">
          </div>
          </div>

          <!-- 右侧玩家卡片 -->
          <div class="flex-1 overflow-hidden battle-player-card -z-[1]">
            <div
              class="player-card rounded-xl sm:rounded-2xl p-2 sm:p-4 border-2 shadow-lg relative h-full min-h-[180px] sm:min-h-[200px] flex flex-col"
              :class="{
                'bg-gradient-to-br from-blue-light to-blue-light-hover border-blue-32/20': battle.status !== 'ended',
                'bg-gradient-to-br from-grey-light to-grey-light-hover border-grey-normal/20': battle.status === 'ended'
              }"
            >
              <!-- 主要内容区域 -->
              <div class="flex-1 flex flex-col-reverse sm:flex-row gap-1 sm:gap-2">
                <!-- 左侧：预测文字 -->
                <div class="flex-1">
                  <div class="text-sm sm:text-base text-grey-normal leading-relaxed h-full">
                    <div class="line-clamp-5">
                      {{ battle.rightPlayer.prediction }}
                    </div>
                  </div>
                </div>

                <!-- 右侧：头像、用户名和支持按钮 -->
                <div class="flex flex-row sm:flex-col items-center gap-2 w-1/3 min-w-1/3">
                  <div class="relative">
                    <UserAvatar
                      :profile-img="battle.rightPlayer.avatar"
                      :name="battle.rightPlayer.name"
                      :username="battle.rightPlayer.username"
                      :followers="0"
                      :followings="0"
                      :credit="0"
                      :steem-id="null"
                      :eth-addr="null"
                      :teleported="false"
                    >
                      <template #avatar-img>
                        <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 sm:border-3 border-blue-32 shadow-md">
                          <img
                            v-if="battle.rightPlayer.avatar"
                            :src="battle.rightPlayer.avatar"
                            :alt="battle.rightPlayer.name"
                            class="w-full h-full object-cover"
                          >
                          <div v-else class="w-full h-full bg-blue-32 flex items-center justify-center">
                            <i-ep-avatar class="text-white text-lg sm:text-2xl" />
                          </div>
                        </div>
                      </template>
                    </UserAvatar>

                    <!-- Winner 标识 -->
                    <div
                      v-if="battle.status === 'ended' && getWinner(battle) === 'right'"
                      class="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-34 rounded-full border-2 border-white flex items-center justify-center shadow-lg"
                    >
                      <img src="~@/assets/icons/icon-pk.png" alt="Winner" class="w-2 h-2 sm:w-3 sm:h-3" />
                    </div>

                    <!-- 在线状态指示器 -->
                    <div v-else class="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-34 rounded-full border-2 border-white flex items-center justify-center">
                      <div class="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <!-- 用户名 -->
                  <div class="text-center flex flex-col items-center justify-center">
                    <p class="text-sm font-bold text-blue-32 leading-tight break-words">
                      {{ battle.rightPlayer.name }}
                    </p>
                    <p class="text-xs text-blue-32/70">
                      {{ formatSupporters(battle.rightPlayer.supporters) }} 支持
                    </p>
                  </div>

                  <!-- 支持按钮 -->
                  <button
                    v-if="battle.status !== 'ended'"
                    @click="supportPlayer(battle.id, battle.rightPlayer.id)"
                    class="hidden sm:w-8 sm:h-8 rounded-full sm:flex items-center justify-center transition-all duration-200"
                    :class="{
                      'bg-blue-32 text-white shadow-lg': battle.rightPlayer.isSupported,
                      'bg-white text-blue-32 border border-blue-32 hover:bg-blue-32 hover:text-white': !battle.rightPlayer.isSupported
                    }"
                  >
                    <i class="w-3 h-3 sm:w-4 sm:h-4" :class="battle.rightPlayer.isSupported ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                  </button>
                </div>
              </div>
              <div class="flex justify-center sm:hidden">
                <!-- 支持按钮 -->
                <button
                    v-if="battle.status !== 'ended'"
                    @click="supportPlayer(battle.id, battle.rightPlayer.id)"
                    class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200"
                    :class="{
                      'bg-blue-32 text-white shadow-lg': battle.rightPlayer.isSupported,
                      'bg-white text-blue-32 border border-blue-32 hover:bg-blue-32 hover:text-white': !battle.rightPlayer.isSupported
                    }"
                >
                  <i class="w-3 h-3 sm:w-4 sm:h-4" :class="battle.rightPlayer.isSupported ? 'btn-icon-curate-active' : 'btn-icon-curate'"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
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

.player-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s;
}

.player-card:hover::before {
  transform: translateX(100%);
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
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
    margin: 0 -8px;
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
    margin: 0 -4px;
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
