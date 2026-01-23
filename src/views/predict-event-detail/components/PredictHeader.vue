<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatAddress, parseTimestamp } from '@/utils/helper'
import TweetBtnCurate from '@/components/tweets/TweetBtnCurate.vue'
import type { EventPredictData, CommunityMember } from '@/types'
import { useClipboard, useNow } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { getUserPredictVP, voteEventPrediction } from '@/apis/api'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { handleErrorTip } from '@/utils/notify'
import { useI18n } from 'vue-i18n'
import { MAX_VP, VP_CONSUME, VP_RECOVER_DAY } from '@/config'

const props = defineProps<{
  market: EventPredictData
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard()
const router = useRouter()
const accStore = useAccountStore()
const now = useNow()

// 投票相关状态
const voting = ref(false)
const showVoteModal = ref(false)
const currentVP = ref(0)
const selectedVoteOption = ref<'yes' | 'no' | null>(null)
const showPopover = ref(false)

const voteEndTime = computed(() => props.market.endTime * 1000 + 86400000)
const tradeEndTime = computed(() => props.market.endTime * 1000)

const isVoting = computed(() => {
  // 使用 now.value 确保响应式更新
  const current = now.value.getTime()
  return props.market.status == 2 && (voteEndTime.value > current && tradeEndTime.value < current)
})

// 时间格式化辅助函数
const pad = (n: number) => n.toString().padStart(2, '0')

const formatDurationColon = (ms: number) => {
  if (ms < 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  // 如果超过24小时，显示天数
  if (h > 24) {
      const d = Math.floor(h / 24)
      const remainH = h % 24
      return `${d}d ${pad(remainH)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const formatDurationText = (ms: number) => {
  if (ms < 0) return '0s'
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  const hours = Math.floor(ms / (1000 * 60 * 60))
  
  if (hours > 0) {
      return `${hours}h${minutes}min${seconds}s`
  }
  return `${minutes}min${seconds}s`
}

const statusText = computed(() => {
  if (props.market.winner) return t('ended')
  
  const current = now.value.getTime()
  
  // 投票阶段
  if (isVoting.value) {
    const diff = voteEndTime.value - current
    return `${t('predictTrade.timeLeftVoting')}${formatDurationText(diff)}`
  }
  
  // 交易阶段 (未结束且未开始投票)
  if (!props.market.winner && current < tradeEndTime.value) {
     const diff = tradeEndTime.value - current
     return `${t('predictTrade.endStill')}${formatDurationColon(diff)}`
  }
  
  // 已经结束但还没有 winner 状态（等待结算中）
  if (current >= voteEndTime.value) {
      return t('ended')
  }
  
  // 处于交易结束到投票开始之间的短暂间隙（如果有）或者状态不对齐
  return t('ended')
})

// 判断用户是否已投票（voteResult 不为空：不为 null、undefined 或 0）
const hasVoted = computed(() => {
  return props.market.voteResult !== null && props.market.voteResult !== undefined && props.market.voteResult !== 0
})

const openTweet = () => {
  router.push(`/post-detail/${props.market.tweetId as string}`)
}

const voteYesAmount = computed(() => {
  return props.market.voteYes ?? 0
})

const voteNoAmount = computed(() => {
  return props.market.voteNo ?? 0
})

const totalCuration = computed(() => {
  return voteYesAmount.value + voteNoAmount.value
})

const voteTotal = computed(() => {
  return (props.market.voteYes ?? 0) + (props.market.voteNo ?? 0)
})

const voteYesPercent = computed(() => {
  if (voteTotal.value === 0) return 0
  return Math.round((props.market.voteYes ?? 0) / voteTotal.value * 100)
})

const voteNoPercent = computed(() => {
  if (voteTotal.value === 0) return 0
  return 100 - voteYesPercent.value
})

// 投票前准备
const preVote = async (yes: boolean) => {
  if (hasVoted.value) return;
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return;
  }

  if (!accStore.getAccountInfo?.steemId) {
    useModalStore().setModalVisible(true, GlobalModalType.Register)
    return false;
  }

  try {
    voting.value = true;
    const vpInfo: CommunityMember | unknown = await getUserPredictVP(accStore.getAccountInfo?.twitterId, props.market.tick)

    let vp = 200
    // 如果没有社区成员记录，则默认给200vp
    if (vpInfo && typeof vpInfo === 'object' && 'lastUpdateVPStamp' in vpInfo && 'predictVP' in vpInfo) {
      if (vpInfo.lastUpdateVPStamp == 0) {
        vp = 200;
      } else {
        vp = ((vpInfo as CommunityMember).predictVP + (Date.now() - (vpInfo as CommunityMember).lastUpdateVPStamp) * MAX_VP / (86400000 * VP_RECOVER_DAY))
        vp = vp > MAX_VP ? MAX_VP : vp
      }
    }

    currentVP.value = Math.floor(vp);
    selectedVoteOption.value = yes ? 'yes' : 'no';
    showVoteModal.value = true;

  } catch (error) {
    handleErrorTip(error)
  } finally {
    voting.value = false;
  }
}

// 确认投票
const vote = async () => {
  try {
    voting.value = true
    await voteEventPrediction(accStore.getAccountInfo?.twitterId, props.market.marketMaker, selectedVoteOption.value == 'yes' ? 1 : 2)
    showVoteModal.value = false
    // 投票成功后可以触发父组件刷新数据
    // emit('voteSuccess')
  } catch (error) {
    handleErrorTip(error)
  } finally {
    voting.value = false;
  }
}

</script>

<template>
  <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm mb-4">
    <!-- Title & Status -->
    <div class="flex justify-between items-start mb-6">
      <h1 class="text-lm sm:text-xl font-bold leading-tight pr-4 flex-1">
        {{ market.title }}
      </h1>
      <div class="flex flex-col items-end gap-2">
         <span 
          class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
          :class="{
            'bg-green-light text-green-dark': !market.winner && now.getTime() < voteEndTime,
            'bg-grey-light text-grey-normal': !!market.winner || now.getTime() >= voteEndTime
          }"
         >
          {{ statusText }}
        </span>
        <div class="flex items-center gap-1">
          <span 
            @click="copy(market.marketMaker)"
            class="text-xs text-blue-600 font-mono underline cursor-pointer hover:text-blue-800 transition-colors"
            title="Click to copy address"
          >
            {{ formatAddress(market.marketMaker) }}
          </span>
          <span v-if="copied" class="text-[10px] text-green-600 font-bold animate-pulse">Copied!</span>
        </div>
      </div>
    </div>

    <!-- Single Tweet Card -->
    <div class="flex flex-col gap-3 sm:gap-4 relative overflow-hidden">
      <div @click="openTweet()" class="flex items-stretch gap-3 sm:gap-4 cursor-pointer hover:opacity-90 transition-opacity">
        <!-- 左侧：头像和用户名 -->
        <div class="flex flex-col items-center gap-2 flex-shrink-0 w-20 sm:w-24">
          <div class="relative">
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-red-normal shadow-md">
              <img v-if="market?.profile" :src="market?.profile" :alt="market.twitterName" class="w-full h-full object-cover">
              <div v-else class="w-full h-full bg-red-normal flex items-center justify-center">
                <i-ep-avatar class="text-white text-lg sm:text-2xl" />
              </div>
            </div>
          </div>
          <p class="text-xs sm:text-sm font-bold text-red-normal leading-tight break-words text-center max-w-[80px]">
            {{ market.twitterUsername }}
          </p>
        </div>

        <!-- 中间：推文内容 -->
        <div class="flex-1 overflow-hidden min-w-0">
          <div class="text-sm sm:text-base text-grey-normal leading-relaxed">
            <div class="line-clamp-3 sm:line-clamp-4" :title="market?.content ?? ''">
              {{ market?.content ?? '' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 底部：投票按钮区域 -->
      <div class="flex gap-3 sm:gap-4 mt-2" @click.stop>
        <!-- 投票状态：两个投票按钮 -->
        <div v-if="isVoting" class="flex gap-3 sm:gap-4 w-full">
          <!-- Vote Yes 按钮 -->
          <div class="relative flex-1">
            <button 
              class="w-full h-10 sm:h-12 bg-red-normal text-white text-sm sm:text-base font-bold rounded-lg shadow-md transition-all duration-200 flex items-center justify-center vote-yes-btn"
              :class="{
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]': !hasVoted,
                'opacity-50 cursor-not-allowed': hasVoted
              }"
              :disabled="hasVoted"
              @click="preVote(true)"
            >
              {{ $t('predictTrade.voteYes') || '投票Yes' }} <span class="ml-1 text-xs opacity-90">({{ voteYesPercent }}%)</span>
            </button>
            <div v-if="market.voteResult === 1" class="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm z-10">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
          <!-- Vote No 按钮 -->
          <div class="relative flex-1">
            <button 
              class="w-full h-10 sm:h-12 bg-blue-600 text-white text-sm sm:text-base font-bold rounded-lg shadow-md transition-all duration-200 flex items-center justify-center vote-no-btn"
              :class="{
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]': !hasVoted,
                'opacity-50 cursor-not-allowed': hasVoted
              }"
              :disabled="hasVoted"
              @click="preVote(false)"
            >
              {{ $t('predictTrade.voteNo') || '投票No' }} <span class="ml-1 text-xs opacity-90">({{ voteNoPercent }}%)</span>
            </button>
            <div v-if="market.voteResult === 2" class="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm z-10">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 投票确认弹窗 -->
    <van-dialog v-model:show="showVoteModal" :show-confirm-button="false" :show-cancel-button="false"
      class="vote-confirm-dialog" close-on-click-overlay>
      <div class="py-6 px-10 relative">
        <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          @click="showVoteModal = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-xl font-bold text-center mb-4 text-gray-800">{{ $t('predictTrade.voteConfirmTitle') }}</h3>

        <p class="text-gray-500 text-ml mb-4 leading-relaxed">
          {{ $t('predictTrade.voteConfirmText') }}
        </p>

        <p class="text-center text-base font-medium text-blue-600 mb-8 bg-blue-50 py-2 rounded-lg">
          {{ selectedVoteOption === 'yes' ? $t('predictTrade.voteForYes') : $t('predictTrade.voteForNo') }}
        </p>

        <div class="flex flex-col gap-4 mb-8">
          <div class="flex items-center text-base">
            <div class="flex items-center gap-1 w-28">
              <span class="text-gray-600">{{ $t('predictTrade.vpConsume') }}</span>

              <van-popover v-model:show="showPopover" theme="dark" placement="top">
                <div class="p-3 text-xs w-64 text-center leading-relaxed">
                  {{ $t('predictTrade.vpDesc') }}
                </div>
                <template #reference>
                  <div class="cursor-help flex items-center" @mouseenter="showPopover = true"
                    @mouseleave="showPopover = false">
                    <svg xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </template>
              </van-popover>
            </div>
            <span class="text-red-500 font-medium text-lg">: {{ VP_CONSUME.PREDICT_VOTE }}</span>
          </div>
          <div class="flex items-center text-base">
            <span class="text-gray-600 w-28">{{ $t('predictTrade.vpRemain') }}</span>
            <span class="font-medium text-lg"
              :class="currentVP >= VP_CONSUME.PREDICT_VOTE ? 'text-green-500' : 'text-red-500'">
              : {{ currentVP }}
            </span>
          </div>
        </div>

        <button
          class="w-full py-3 rounded-full text-white font-bold text-lg shadow-md transition-all duration-200 flex items-center justify-center"
          :class="(currentVP >= VP_CONSUME.PREDICT_VOTE && !voting) ? 'bg-gradient-primary hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]' : 'bg-gray-300 cursor-not-allowed'"
          :disabled="currentVP < VP_CONSUME.PREDICT_VOTE || voting" @click="vote">
          {{ $t('predictTrade.voteConfirmBtn') }}
          <i-ep-loading v-if="voting" class="animate-spin mr-2" />
        </button>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped>
/* 投票按钮样式覆盖 */
.vote-yes-btn:disabled,
.vote-no-btn:disabled {
  cursor: not-allowed;
}

.bg-gradient-primary {
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
}
</style>

