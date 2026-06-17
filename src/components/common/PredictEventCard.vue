<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { getUserPredictVP, newParticipation, voteEventPrediction, createPredictCommerce, tweet } from '@/apis/api';
import { buildPlatformPostText, isNativeTwitterAccount, openTwitterIntent } from '@/utils/twitterPost';
import { useAccount } from '@/composables/useAccount';
import { OP_CONSUME } from '@/config';
import { notify } from '@/utils/notify';
import type { BattleData, CommunityMember, EventPredictData, Tweet } from '@/types'
import { formatAmount, parseTimestamp } from '@/utils/helper';
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { usePredictVolUsd } from '@/composables/usePredictVolUsd'
import { formatUsdCompact } from '@/utils/format'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useRouter } from 'vue-router';
import { useEventPredict } from '@/composables/usePredict';
import { useEventMarketOutcomes, OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes';
import { usePredictVoteHighlight } from '@/composables/usePredictVoteHighlight';
import { getOutcomeFlagUrl } from '@/composables/useWorldCupMarkets';
import { buyToken, getBuyData, getMarketInfos, getEventMarketInfos } from '@/utils/fpmm';
import debounce from 'lodash.debounce';
import { parseUnits } from 'viem';
import { handleErrorTip } from '@/utils/notify';
import { ensureUserIPShare } from '@/composables/useIPShareGate';
import PredictShareDialog from '@/components/common/PredictShareDialog.vue';
import { MAX_VP, VP_CONSUME, VP_RECOVER_DAY } from '@/config';
import { useNow } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  market: EventPredictData,
  showCommunity?: boolean
}>()

defineOptions({ inheritAttrs: false })
const router = useRouter();
const accStore = useAccountStore();
const { updateUserOPLocal } = useAccount();
const { percentA, percentB } = useEventPredict(props.market);
const {
  isMultiOutcome,
  outcomeList,
  outcomePercents,
  winningOutcomeIndex,
  getOutcomeLabel,
} = useEventMarketOutcomes(() => props.market);
const { hasVoted, isVotedOutcome, applyLocalVote } = usePredictVoteHighlight(() => props.market);
const { t } = useI18n();
const now = useNow();

// 购买状态管理
const showBuyInput = ref(false);
/** 选中的 outcome：二元 0=Yes/1=No，多元为 outcomeIndex */
const selectedOutcomeIndex = ref<number | null>(null);
const buyAmount = ref('');
const willReceiveAmount = ref(0);
const calculatingAmount = ref(false);
const bnbFee = ref(0);
const trading = ref(false);
const voting = ref(false);
const showVoteModal = ref(false);
const currentVP = ref(0);
const selectedVoteOption = ref<'yes' | 'no' | null>(null);
const selectedVoteOutcomeIndex = ref<number | null>(null);
const showPopover = ref(false);
const showVotePhaseHelp = ref(false);

const isResolved = computed(() => props.market.status === 3 || !!props.market.winner);

const getOutcomeColor = (idx: number) =>
  OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length];

const refreshMarketReserves = async () => {
  if (isMultiOutcome.value) {
    const infos = await getEventMarketInfos(props.market);
    props.market.outcomeReserves = infos.reserves;
    props.market.reserveA = infos.reserves[0] ?? 0;
    props.market.reserveB = infos.reserves[1] ?? 0;
    props.market.fee = infos.fee;
    return;
  }
  const marketInfos = await getMarketInfos([props.market]);
  props.market.reserveA = marketInfos[props.market.marketMaker + '-priceA'];
  props.market.reserveB = marketInfos[props.market.marketMaker + '-priceB'];
  props.market.fee = marketInfos[props.market.marketMaker + '-fee'];
};

// 列表页由父级批量 multicall 注入 outcomeReserves，此处不再逐卡请求

// 交易量（USD）：优先 tradeVolume，未回填时回退池内储备，与 /predictions 标签条口径一致
const volUsd = usePredictVolUsd(() => props.market)

const aAmount = computed(() => {
  return props.market.voteYes ?? 0
})
const bAmount = computed(() => {
  return props.market.voteNo ?? 0
})

const totalCuration = computed(() => {
  return aAmount.value + bAmount.value
})

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
  if (isResolved.value) return t('ended')
  
  const current = now.value.getTime()
  
  // 投票阶段
  if (isVoting.value) {
    const diff = voteEndTime.value - current
    return `${t('predictTrade.timeLeftVoting')}${formatDurationText(diff)}`
  }
  
  // 交易阶段 (未结束且未开始投票)
  if (!isResolved.value && current < tradeEndTime.value) {
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
  if (!isMultiOutcome.value) {
    const total = totalCuration.value
    if (total <= 0) return 0
    return outcomeIndex === 0
      ? Math.round((aAmount.value / total) * 100)
      : Math.round((bAmount.value / total) * 100)
  }
  const total = voteTotalMulti.value
  if (total <= 0) return 0
  const outcome = outcomeList.value.find(o => o.outcomeIndex === outcomeIndex)
  return Math.round(((outcome?.voteTotal ?? 0) / total) * 100)
}

const resolvedWinnerLabel = computed(() => {
  if (isMultiOutcome.value && winningOutcomeIndex.value != null) {
    return getOutcomeLabel(winningOutcomeIndex.value)
  }
  return props.market.winner === 'yes' ? t('predictTrade.yes') : t('predictTrade.no')
})

const gotoDetail = () => {
  router.push(`/predict/event/${props.market.marketMaker}`)
}

const openCommunity = (tick: string) => {
  router.push(`/tag-detail/${tick}`)
}

const sharing = ref(false);
const showShareModal = ref(false);
const openShareModal = async () => {
  if (!(await ensureUserIPShare())) return
  showShareModal.value = true;
}
const confirmShare = async (text: string) => {
  if (sharing.value) return;
  sharing.value = true;
  try {
    const twitterId = accStore.getAccountInfo!.twitterId!
    const res: any = await createPredictCommerce(
      twitterId,
      props.market.marketMaker,
      'event',
    );
    if (res?.c !== 0 || !res?.d?.commerceUrl) {
      handleErrorTip(res);
      return;
    }
    const account = accStore.getAccountInfo!
    if (isNativeTwitterAccount(account.accountType)) {
      openTwitterIntent({
        text,
        tick: props.market.tick,
        commerceUrl: res.d.commerceUrl,
      });
      notify({ message: 'Opening Twitter to share...' });
    } else {
      const postText = buildPlatformPostText(text, {
        tick: props.market.tick,
        commerceUrl: res.d.commerceUrl,
      })
      await tweet(twitterId, postText, props.market.tick)
      updateUserOPLocal(OP_CONSUME.POST)
      notify({ message: 'Shared successfully' });
    }
    showShareModal.value = false;
  } catch (e) {
    handleErrorTip(e);
  } finally {
    sharing.value = false;
  }
}

const openBuyInput = (outcomeIndex: number) => {
  if (props.market.status !== 1) return;
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  selectedOutcomeIndex.value = outcomeIndex;
  showBuyInput.value = true;
  buyAmount.value = '';
}

// 购买 Yes（二元）
const buyYes = () => openBuyInput(0)

// 购买 No（二元）
const buyNo = () => openBuyInput(1)

// 购买指定 outcome（多元）
const buyOutcome = (outcomeIndex: number) => openBuyInput(outcomeIndex)

// 关闭购买输入
const closeBuyInput = () => {
  showBuyInput.value = false;
  selectedOutcomeIndex.value = null;
  buyAmount.value = '';
  willReceiveAmount.value = 0;
}

const getBuyOutcomeArg = (): 'yes' | 'no' | number => {
  if (selectedOutcomeIndex.value == null) return 'yes';
  if (isMultiOutcome.value) return selectedOutcomeIndex.value;
  return selectedOutcomeIndex.value === 0 ? 'yes' : 'no';
}

// 计算获得的代币数量
const calculateReceiveAmount = debounce(async () => {
  if (!buyAmount.value || parseFloat(buyAmount.value) <= 0 || selectedOutcomeIndex.value == null) {
    willReceiveAmount.value = 0;
    return;
  }
  try {
    calculatingAmount.value = true;
    await refreshMarketReserves();
    const result = await getBuyData(props.market, parseFloat(buyAmount.value), getBuyOutcomeArg());
    if (result && typeof result === 'object' && 'amount' in result) {
      willReceiveAmount.value = result.amount || 0;
      bnbFee.value = result.fee;
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
watch([buyAmount, selectedOutcomeIndex], () => {
  if (showBuyInput.value && selectedOutcomeIndex.value != null) {
    calculateReceiveAmount();
  }
});

// 确认购买
const confirmBuy = async () => {
  if (trading.value) return;
  trading.value = true;
  try {
    const hash = await buyToken(
      props.market,
      props.market.token as `0x${string}`,
      parseUnits(parseFloat(buyAmount.value).toFixed(18), 18),
      willReceiveAmount.value * 0.95,
      getBuyOutcomeArg(),
      bnbFee.value
    )
    console.log('buy hash', hash)
    if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
      await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, props.market.marketMaker as `0x${string}`, 'event')
    }
    refreshMarketReserves().catch(() => {})
  } catch (error) {
    handleErrorTip(error)
  } finally {
    trading.value = false;
    // 购买成功后关闭输入框
    closeBuyInput();
  }
}

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

const preVoteOutcome = async (outcomeIndex: number) => {
  if (hasVoted.value) return;
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return;
  }
  if (!accStore.getAccountInfo?.steemId) {
    useModalStore().setModalVisible(true, GlobalModalType.Register)
    return;
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
    selectedVoteOutcomeIndex.value = outcomeIndex;
    selectedVoteOption.value = null;
    showVoteModal.value = true;
  } catch (error) {
    handleErrorTip(error)
  } finally {
    voting.value = false;
  }
}

const vote = async () => {
  try {
    voting.value = true
    if (isMultiOutcome.value && selectedVoteOutcomeIndex.value != null) {
      await voteEventPrediction(
        accStore.getAccountInfo?.twitterId,
        props.market.marketMaker,
        undefined,
        undefined,
        selectedVoteOutcomeIndex.value
      )
      applyLocalVote(props.market, selectedVoteOutcomeIndex.value)
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

const selectedBuyLabel = computed(() => {
  if (selectedOutcomeIndex.value == null) return '';
  if (isMultiOutcome.value) return getOutcomeLabel(selectedOutcomeIndex.value);
  return selectedOutcomeIndex.value === 0 ? t('predictTrade.yes') : t('predictTrade.no');
})

const selectedBuyColor = computed(() => {
  if (selectedOutcomeIndex.value == null) return OUTCOME_CHART_COLORS[0];
  return getOutcomeColor(selectedOutcomeIndex.value);
})

</script>

<template>
  <div
    v-bind="$attrs"
    @click="gotoDetail()"
    class="battle-card bg-white rounded-2xl p-2 sm:p-4 shadow-sm border mb-3 border-grey-light">
    <!-- 卡片头部 -->
    <div class="flex justify-between items-start">
      <h3 class="text-base sm:text-lg font-semibold text-black flex-1 pr-2 md:h-[3rem] md:line-clamp-2">
        {{ market.title }}
        <span v-if="showCommunity" class="cursor-pointer" @click.stop="openCommunity(market.tick)">
          (@<span class="text-blue-600 underline">{{ market.tick }}</span>)
        </span>
      </h3>
      <button
        @click.stop="openShareModal()"
        class="p-1 rounded-full hover:bg-gray-100 transition-colors self-start"
        :class="{ 'opacity-50 pointer-events-none': sharing }"
        title="Share to Twitter"
      >
        <i-ep-promotion class="w-4 h-4 text-gray-400" />
      </button>
    </div>

    <!-- 对战双方 - 上下布局 -->
    <div class="flex flex-col gap-3 sm:gap-4 relative overflow-hidden rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4"
      :class="{
        'bg-gray-50 border-gray-200': !isResolved,
        'bg-gradient-to-br from-grey-light to-grey-light-hover border-grey-normal/20': isResolved
      }">
      <div class="flex items-stretch gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg border border-red-normal/20 bg-white/50">
        <!-- 左侧：头像和用户名 -->
        <div class="flex flex-col items-center gap-2 flex-shrink-0 w-20 sm:w-24">
          <div class="relative">
            <UserAvatar :profile-img="market?.profile" :name="market.twitterName" :username="market.twitterUsername"
              :followers="market.followers" :followings="market.followings" :credit="market.credit"
              :steem-id="market.steemId" :eth-addr="market.ethAddr" :teleported="true">
              <template #avatar-img>
                <div
                  class="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-red-normal shadow-md">
                  <img v-if="market?.profile" :src="market?.profile" :alt="market?.twitterName"
                    class="w-full h-full object-cover">
                  <div v-else class="w-full h-full bg-red-normal flex items-center justify-center">
                    <i-ep-avatar class="text-white text-lg sm:text-2xl" />
                  </div>
                </div>
              </template>
            </UserAvatar>
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

        <!-- 右侧：结果显示 -->
      </div>
      <!-- 二元 Yes/No 概率条（结束后展示 end_time 快照） -->
      <div v-if="!isMultiOutcome" class="mt-2 h-5 rounded-full overflow-hidden flex bg-grey-light-active" @click.stop>
        <div class="h-full bg-red-normal transition-all duration-300 flex items-center justify-center" :style="{ width: (percentA * 100).toFixed(1) + '%' }">
          <span v-if="percentA > 0.08" class="text-white text-[10px] font-bold leading-none truncate px-1">{{ (percentA * 100).toFixed(0) }}%</span>
        </div>
        <div class="h-full bg-blue-600 transition-all duration-300 flex items-center justify-center" :style="{ width: (percentB * 100).toFixed(1) + '%' }">
          <span v-if="percentB > 0.08" class="text-white text-[10px] font-bold leading-none truncate px-1">{{ (percentB * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <!-- 多元 outcome 概率条（N 段；结束后展示 end_time 快照） -->
      <div v-if="isMultiOutcome" class="mt-2 h-5 rounded-full overflow-hidden flex bg-grey-light-active" @click.stop>
        <div
          v-for="(pct, idx) in outcomePercents"
          :key="idx"
          class="h-full transition-all duration-300 flex items-center justify-center"
          :style="{
            width: (pct * 100).toFixed(1) + '%',
            backgroundColor: getOutcomeColor(idx),
          }"
        >
          <span v-if="pct > 0.08" class="text-white text-[10px] font-bold leading-none truncate px-1">{{ (pct * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <!-- 底部：购买/投票按钮区域 -->
      <div class="flex flex-col gap-1.5 mt-2" @click.stop>
        <!-- 阶段标识：交易 vs 投票 -->
        <div
          v-if="!showBuyInput && !isResolved"
          class="flex items-center gap-1.5 px-0.5"
        >
          <span
            class="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full"
            :class="isVoting ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'"
          >
            {{ isVoting ? $t('predictTrade.phaseVote') : $t('predictTrade.phaseTrade') }}
          </span>
          <van-popover v-if="isVoting" v-model:show="showVotePhaseHelp" theme="dark" placement="top">
            <div class="p-3 text-xs w-72 max-w-[85vw] leading-relaxed">
              {{ $t('predictTrade.phaseVoteDesc') }}
            </div>
            <template #reference>
              <button
                type="button"
                class="cursor-help flex items-center shrink-0 text-orange-600/80 hover:text-orange-700"
                aria-label="?"
                @click.stop="showVotePhaseHelp = !showVotePhaseHelp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </template>
          </van-popover>
        </div>

        <Transition name="buy-buttons" mode="out-in">

          <!-- 多元市场：交易阶段 3 个购买按钮 -->
          <div
            v-if="!showBuyInput && isMultiOutcome && !isVoting && !isResolved"
            key="multi-buttons"
            class="grid grid-cols-3 gap-2 w-full"
          >
            <button
              v-for="(outcome, idx) in outcomeList"
              :key="outcome.outcomeIndex"
              class="min-h-10 sm:min-h-12 px-1 text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center gap-0.5 tabular-nums"
              :style="{ backgroundColor: getOutcomeColor(idx) }"
              @click="buyOutcome(outcome.outcomeIndex)"
            >
              <span class="text-base sm:text-lg">{{ (outcomePercents[idx] * 100).toFixed(0) }}%</span>
              <span class="text-[10px] sm:text-xs font-semibold opacity-90 text-center leading-tight px-0.5 flex items-center justify-center gap-1">
                <img v-if="getOutcomeFlagUrl(outcome.label)" :src="getOutcomeFlagUrl(outcome.label)"
                  class="w-4 h-3 rounded-[2px] object-cover shrink-0" alt="" loading="lazy" />
                <span class="line-clamp-2">{{ outcome.label }}</span>
              </span>
            </button>
          </div>

          <!-- 多元市场：投票阶段 3 个投票按钮 -->
          <div
            v-else-if="!showBuyInput && isMultiOutcome && isVoting"
            key="multi-vote"
            class="grid grid-cols-3 gap-2 w-full pt-1"
          >
            <div
              v-for="(outcome, idx) in outcomeList"
              :key="'vote-' + outcome.outcomeIndex"
              class="relative"
            >
              <button
                class="relative w-full h-10 sm:h-12 px-2 text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center bg-white border-2"
                :style="{
                  borderColor: getOutcomeColor(idx),
                  color: getOutcomeColor(idx),
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
                  :style="isVotedOutcome(outcome.outcomeIndex) ? undefined : { backgroundColor: getOutcomeColor(idx) }"
                >{{ isVotedOutcome(outcome.outcomeIndex) ? $t('predictTrade.yourVoteBadge') : $t('predictTrade.actionVote') }}</span>
                <span class="text-center leading-tight flex items-center justify-center gap-1 px-1">
                  <img v-if="getOutcomeFlagUrl(outcome.label)" :src="getOutcomeFlagUrl(outcome.label)"
                    class="w-4 h-3 rounded-[2px] object-cover shrink-0" alt="" loading="lazy" />
                  <span class="line-clamp-2">{{ outcome.label }}</span>
                  <span class="text-xs font-semibold opacity-80 shrink-0">({{ getVotePercent(outcome.outcomeIndex) }}%)</span>
                </span>
              </button>
            </div>
          </div>

          <!-- 多元市场：已结算结果 -->
          <div
            v-else-if="!showBuyInput && isMultiOutcome && isResolved"
            key="multi-winner"
            @click="gotoDetail()"
            class="w-full h-10 sm:h-12 bg-grey-light-active text-grey-normal text-sm sm:text-base font-bold rounded-lg cursor-pointer hover:bg-grey-light-hover transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C9.243 2 7 4.243 7 7v2H4a1 1 0 00-1 1v2c0 2.206 1.794 4 4 4h.535c.882 1.785 2.618 3.073 4.682 3.414.024.004.048.006.072.006h1.422c.024 0 .048-.002.072-.006 2.064-.341 3.8-1.629 4.682-3.414H18c2.206 0 4-1.794 4-4v-2a1 1 0 00-1-1h-3V7c0-2.757-2.243-5-5-5zm8 8v1c0 1.103-.897 2-2 2h-.535c.028-.329.035-.661.035-1v-2H20zm-16 0h2.5v2c0 .339.007.671.035 1H6c-1.103 0-2-.897-2-2v-1zm8 8h-2v-2h2v2z"/>
            </svg>
            <span class="text-sm sm:text-base font-bold truncate">
              ✓ {{ $t('predictTrade.winner') || 'Winner' }}: {{ resolvedWinnerLabel }}
            </span>
          </div>

          <!-- 二元市场：交易期购买 -->
          <div v-else-if="!showBuyInput && !isMultiOutcome && !isVoting && !isResolved" key="binary-trade" class="flex gap-3 sm:gap-4 w-full">
            <button
              class="flex-1 h-10 sm:h-12 bg-red-normal text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center gap-0.5 tabular-nums"
              @click="buyYes()"
            >
              <span class="text-base sm:text-lg">{{ (percentA * 100).toFixed(0) }}%</span>
              <span class="text-xs sm:text-sm font-semibold opacity-90">{{ $t('predictTrade.buyYes') }}</span>
            </button>
            <button
              class="flex-1 h-10 sm:h-12 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center gap-0.5 tabular-nums"
              @click="buyNo()"
            >
              <span class="text-base sm:text-lg">{{ (percentB * 100).toFixed(0) }}%</span>
              <span class="text-xs sm:text-sm font-semibold opacity-90">{{ $t('predictTrade.buyNo') }}</span>
            </button>
          </div>

          <!-- 二元市场：投票期 -->
          <div v-else-if="!showBuyInput && !isMultiOutcome && isVoting" key="binary-vote" class="flex gap-3 sm:gap-4 w-full pt-1">
            <div class="relative flex-1">
              <button
                class="relative w-full h-10 sm:h-12 px-2 bg-white border-2 border-red-normal text-red-normal text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center"
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
                <span>{{ $t('predictTrade.voteYes') }} <span class="text-xs font-semibold opacity-80">({{ getVotePercent(0) }}%)</span></span>
              </button>
            </div>
            <div class="relative flex-1">
              <button
                class="relative w-full h-10 sm:h-12 px-2 bg-white border-2 border-blue-600 text-blue-600 text-sm sm:text-base font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center"
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
                <span>{{ $t('predictTrade.voteNo') }} <span class="text-xs font-semibold opacity-80">({{ getVotePercent(1) }}%)</span></span>
              </button>
            </div>
          </div>

          <!-- 二元市场：已结算 -->
          <div
            v-else-if="!showBuyInput && !isMultiOutcome && isResolved"
            key="binary-winner"
            @click="gotoDetail()"
            class="w-full h-10 sm:h-12 bg-grey-light-active text-grey-normal text-sm sm:text-base font-bold rounded-lg cursor-pointer hover:bg-grey-light-hover transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C9.243 2 7 4.243 7 7v2H4a1 1 0 00-1 1v2c0 2.206 1.794 4 4 4h.535c.882 1.785 2.618 3.073 4.682 3.414.024.004.048.006.072.006h1.422c.024 0 .048-.002.072-.006 2.064-.341 3.8-1.629 4.682-3.414H18c2.206 0 4-1.794 4-4v-2a1 1 0 00-1-1h-3V7c0-2.757-2.243-5-5-5zm8 8v1c0 1.103-.897 2-2 2h-.535c.028-.329.035-.661.035-1v-2H20zm-16 0h2.5v2c0 .339.007.671.035 1H6c-1.103 0-2-.897-2-2v-1zm8 8h-2v-2h2v2z"/>
            </svg>
            <span class="text-base font-bold truncate">
              ✓ {{ $t('predictTrade.winner') }}: {{ resolvedWinnerLabel }}
            </span>
          </div>

          <!-- 输入状态：输入框、购买按钮、关闭按钮 -->
          <div v-else key="input" class="flex gap-2 sm:gap-3 w-full items-center">
            <input v-model="buyAmount" type="number"
              :placeholder="$t('predictTrade.intputTokenAmount', { tick: market.tick })"
              class="flex-1 h-14 sm:h-16 px-3 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all"
              :style="{ borderColor: selectedBuyColor }"
              @keyup.enter="confirmBuy" />
            <button @click="confirmBuy()"
              class="h-14 sm:h-16 px-4 sm:px-6 text-sm sm:text-base font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex flex-col items-center justify-center text-white"
              :style="{ backgroundColor: selectedBuyColor }"
              :disabled="!buyAmount || parseFloat(buyAmount) <= 0 || calculatingAmount || trading">
              <span>{{ $t('buy') || '购买' }}</span>
              <i-ep-loading v-if="trading" class="animate-spin" />
              <span v-if="willReceiveAmount > 0 && !trading" class="text-xs opacity-90 mt-0.5">
                {{ $t('predictTrade.getResult', {
                  amount: formatAmount(willReceiveAmount),
                  result: selectedBuyLabel
                }) }}
              </span>
              <span v-else-if="calculatingAmount" class="text-xs opacity-90 mt-0.5">
                {{ $t('predictTrade.calculating') }}
              </span>
            </button>
            <button @click="closeBuyInput()"
              class="h-6 sm:h-8 w-8 sm:w-10 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 active:scale-[0.98] transition-all duration-200"
              title="关闭">
              <i-ep-close class="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 底部信息行：左 Vol（交易量 USD），右 倒计时/状态 -->
    <div class="flex justify-between items-center mt-2 gap-2">
      <span v-if="volUsd >= 0.01" class="text-xs sm:text-sm font-semibold text-grey-normal tabular-nums">
        Vol {{ formatUsdCompact(volUsd) }}
      </span>
      <span
        class="ml-auto px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
        :class="{
          'bg-green-light text-green-dark': !isResolved && now.getTime() < voteEndTime,
          'bg-grey-light text-grey-normal': isResolved || now.getTime() >= voteEndTime
        }"
      >
        {{ statusText }}
      </span>
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
          isMultiOutcome && selectedVoteOutcomeIndex != null
            ? getOutcomeLabel(selectedVoteOutcomeIndex)
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

  <!-- 分享弹窗 -->
  <PredictShareDialog
    v-model:show="showShareModal"
    type="event"
    :market-address="market.marketMaker"
    :sharing="sharing"
    @confirm="confirmShare"
  />
</template>

<style scoped>
/* 添加渐变色类，确保与全局一致 */
.bg-gradient-primary {
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
}

.predict-battle-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.battle-card {
  /* hover 不再位移/缩放：translateY+scale 会被滚动容器 overflow-hidden 裁切，
     且与 backdrop-filter 组合在部分 GPU 上引发整卡闪烁（窄屏尤甚）。
     仅保留阴影变化作为 hover 反馈。 */
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.battle-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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

/* 投票按钮样式覆盖 */
.vote-yes-btn:disabled,
.vote-no-btn:disabled {
  cursor: not-allowed;
}

/* VS 标识样式 */
.vs-container {
  position: relative;
  z-index: 10;
  width: 5rem;
  /* 固定宽度 80px */
  flex-shrink: 0;
  /* 不允许收缩 */
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

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-10px);
  }
}

/* 脉冲动画 */
@keyframes pulse {

  0%,
  100% {
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

  0%,
  100% {
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

  0%,
  100% {
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

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .battle-card {
    margin: 0 -8px 0.75rem -8px;
    /* 保持底部边距 mb-3 (0.75rem) */
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
    margin: 0 -4px 0.75rem -4px;
    /* 保持底部边距 mb-3 (0.75rem) */
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
    width: 3rem;
    /* 移动端更小的固定宽度 */
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
  min-width: 0;
  /* 允许在 flex 容器中正确计算 */
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