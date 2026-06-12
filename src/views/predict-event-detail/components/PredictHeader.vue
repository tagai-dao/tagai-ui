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
import { useEventMarketOutcomes, OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'
import { usePredictVoteHighlight } from '@/composables/usePredictVoteHighlight'

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
const selectedOutcomeIndex = ref<number | null>(null)
const showPopover = ref(false)

const { isMultiOutcome, outcomeList, outcomePercents, getOutcomeLabel } = useEventMarketOutcomes(() => props.market)
const { hasVoted, isVotedOutcome, applyLocalVote } = usePredictVoteHighlight(() => props.market)

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

const voteTotalMulti = computed(() =>
  outcomeList.value.reduce((sum, o) => sum + (o.voteTotal ?? 0), 0)
)

const getVotePercent = (outcomeIndex: number) => {
  const total = voteTotalMulti.value
  if (total <= 0) return 0
  const outcome = outcomeList.value.find(o => o.outcomeIndex === outcomeIndex)
  return Math.round(((outcome?.voteTotal ?? 0) / total) * 100)
}

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

// 投票前准备（二元）
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
    selectedOutcomeIndex.value = null;
    showVoteModal.value = true;

  } catch (error) {
    handleErrorTip(error)
  } finally {
    voting.value = false;
  }
}

/** Event V2 多元投票 */
const preVoteOutcome = async (outcomeIndex: number) => {
  if (hasVoted.value) return
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return
  }
  if (!accStore.getAccountInfo?.steemId) {
    useModalStore().setModalVisible(true, GlobalModalType.Register)
    return
  }

  try {
    voting.value = true
    const vpInfo: CommunityMember | unknown = await getUserPredictVP(accStore.getAccountInfo?.twitterId, props.market.tick)
    let vp = 200
    if (vpInfo && typeof vpInfo === 'object' && 'lastUpdateVPStamp' in vpInfo && 'predictVP' in vpInfo) {
      if (vpInfo.lastUpdateVPStamp == 0) {
        vp = 200
      } else {
        vp = ((vpInfo as CommunityMember).predictVP + (Date.now() - (vpInfo as CommunityMember).lastUpdateVPStamp) * MAX_VP / (86400000 * VP_RECOVER_DAY))
        vp = vp > MAX_VP ? MAX_VP : vp
      }
    }
    currentVP.value = Math.floor(vp)
    selectedOutcomeIndex.value = outcomeIndex
    selectedVoteOption.value = null
    showVoteModal.value = true
  } catch (error) {
    handleErrorTip(error)
  } finally {
    voting.value = false
  }
}

// 确认投票
const vote = async () => {
  try {
    voting.value = true
    if (isMultiOutcome.value && selectedOutcomeIndex.value != null) {
      await voteEventPrediction(
        accStore.getAccountInfo?.twitterId,
        props.market.marketMaker,
        undefined,
        undefined,
        selectedOutcomeIndex.value
      )
      applyLocalVote(props.market, selectedOutcomeIndex.value)
    } else {
      const binaryIdx = selectedVoteOption.value === 'yes' ? 0 : 1
      await voteEventPrediction(
        accStore.getAccountInfo?.twitterId,
        props.market.marketMaker,
        binaryIdx === 0 ? 1 : 2
      )
      applyLocalVote(props.market, binaryIdx)
    }
    showVoteModal.value = false
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

    <!-- 多元 outcome 概率条 -->
    <div v-if="isMultiOutcome && !isVoting" class="mb-4 space-y-2">
      <div
        v-for="(outcome, idx) in outcomeList"
        :key="outcome.outcomeIndex"
        class="space-y-1"
      >
        <div class="flex justify-between text-xs text-gray-600">
          <span class="font-medium truncate pr-2">{{ outcome.label }}</span>
          <span class="font-mono font-bold">{{ (outcomePercents[idx] * 100).toFixed(1) }}%</span>
        </div>
        <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :style="{
              width: `${Math.max(outcomePercents[idx] * 100, 2)}%`,
              backgroundColor: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length],
            }"
          />
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

      <!-- 底部：投票按钮区域（仅投票期展示） -->
      <div v-if="isVoting" class="flex flex-col gap-2 mt-2" @click.stop>
        <div class="flex items-center gap-2 px-0.5">
          <span class="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
            {{ $t('predictTrade.phaseVote') }}
          </span>
        </div>

        <!-- 多元 outcome 投票 -->
        <div v-if="isMultiOutcome" class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-1">
          <div
            v-for="(outcome, idx) in outcomeList"
            :key="outcome.outcomeIndex"
            class="relative"
          >
            <button
              class="relative w-full h-10 sm:h-12 px-2 text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center bg-white border-2 vote-yes-btn"
              :style="{
                borderColor: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length],
                color: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length],
              }"
              :class="{
                'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]': !hasVoted,
                'ring-2 ring-green-500 ring-offset-1 shadow-md': isVotedOutcome(outcome.outcomeIndex),
                'opacity-40 cursor-not-allowed': hasVoted && !isVotedOutcome(outcome.outcomeIndex),
              }"
              :disabled="hasVoted"
              @click="preVoteOutcome(outcome.outcomeIndex)"
            >
              <span
                class="absolute -top-1.5 right-1 z-10 text-[8px] leading-none font-bold px-1 py-0.5 rounded shadow-sm text-white"
                :class="isVotedOutcome(outcome.outcomeIndex) ? 'bg-green-500' : ''"
                :style="isVotedOutcome(outcome.outcomeIndex) ? undefined : { backgroundColor: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length] }"
              >{{ isVotedOutcome(outcome.outcomeIndex) ? $t('predictTrade.yourVoteBadge') : $t('predictTrade.actionVote') }}</span>
              <span class="line-clamp-2 text-center leading-tight px-1">
                {{ outcome.label }}
                <span class="text-xs font-semibold opacity-80">({{ getVotePercent(outcome.outcomeIndex) }}%)</span>
              </span>
            </button>
          </div>
        </div>

        <!-- 二元 outcome 投票 -->
        <div v-else class="flex gap-3 sm:gap-4 w-full pt-1">
          <div class="relative flex-1">
            <button
              class="relative w-full h-10 sm:h-12 px-2 bg-white border-2 border-red-normal text-red-normal text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center vote-yes-btn"
              :class="{
                'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]': !hasVoted,
                'ring-2 ring-green-500 ring-offset-1': isVotedOutcome(0),
                'opacity-40 cursor-not-allowed': hasVoted && !isVotedOutcome(0),
              }"
              :disabled="hasVoted"
              @click="preVote(true)"
            >
              <span
                class="absolute -top-1.5 right-1 z-10 text-[8px] leading-none font-bold px-1 py-0.5 rounded shadow-sm text-white"
                :class="isVotedOutcome(0) ? 'bg-green-500' : 'bg-red-normal'"
              >{{ isVotedOutcome(0) ? $t('predictTrade.yourVoteBadge') : $t('predictTrade.actionVote') }}</span>
              <span>{{ $t('predictTrade.voteYes') }} <span class="text-xs font-semibold opacity-80">({{ voteYesPercent }}%)</span></span>
            </button>
          </div>
          <div class="relative flex-1">
            <button
              class="relative w-full h-10 sm:h-12 px-2 bg-white border-2 border-blue-600 text-blue-600 text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center vote-no-btn"
              :class="{
                'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]': !hasVoted,
                'ring-2 ring-green-500 ring-offset-1': isVotedOutcome(1),
                'opacity-40 cursor-not-allowed': hasVoted && !isVotedOutcome(1),
              }"
              :disabled="hasVoted"
              @click="preVote(false)"
            >
              <span
                class="absolute -top-1.5 right-1 z-10 text-[8px] leading-none font-bold px-1 py-0.5 rounded shadow-sm text-white"
                :class="isVotedOutcome(1) ? 'bg-green-500' : 'bg-blue-600'"
              >{{ isVotedOutcome(1) ? $t('predictTrade.yourVoteBadge') : $t('predictTrade.actionVote') }}</span>
              <span>{{ $t('predictTrade.voteNo') }} <span class="text-xs font-semibold opacity-80">({{ voteNoPercent }}%)</span></span>
            </button>
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
          {{
            isMultiOutcome && selectedOutcomeIndex != null
              ? getOutcomeLabel(selectedOutcomeIndex)
              : (selectedVoteOption === 'yes' ? $t('predictTrade.voteForYes') : $t('predictTrade.voteForNo'))
          }}
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

