<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseUnits } from 'viem'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip, notify } from '@/utils/notify'
import { GlobalModalType } from '@/types'
import {
  checkWorldCupMatchCreatable,
  createFPMMMarketForEvent,
  preCreateFPMMMarketEvent,
} from '@/apis/api'
import { OperateType, useTweet } from '@/composables/useTweet'
import { useAccount } from '@/composables/useAccount'
import { useWorldCupTeam } from '@/composables/useWorldCupTeam'
import emitter from '@/utils/emitter'
import { getTokenBalance } from '@/utils/web3'
import { formatAmount } from '@/utils/helper'
import { approveToken, createEventMarketV2 } from '@/utils/fpmm'
import { targetPercentsToDistributionHint } from '@/composables/useEventMarketOutcomes'
import { FPMMDeterministicFactoryEventV2 } from '@/config'
import { WC_TEAMS } from '@/data/world-cup-2026/teams'
import {
  formatKickoffUtcToLocal,
  getGroupMates,
  getGroupMatesWithFixture,
  kickoffUtcToLocalDatePicker,
  type WcTeamWithFixture,
} from '@/data/world-cup-2026/helpers'
import WorldCupTeamPicker from '@/components/common/WorldCupTeamPicker.vue'

type WcFixtureInfo = {
  fixtureId: string
  group: string
  teamA: string
  teamB: string
  kickoffUtc: string
  venue: string
}

type EventType = 'matchup' | 'groupChampion' | 'worldChampion'
type PickerSide = 'left' | 'right'

const { t } = useI18n()
const { preCheckCuration } = useTweet()
const { getTeamName, getMatchTitle, getOutcomeLabels, getTeamFlagUrl } = useWorldCupTeam()
const accStore = useAccountStore()
const modalStore = useModalStore()
const comStore = useCommunityStore()
const { accountMismatch } = useAccount()

const userBalance = ref(0)
const createLoading = ref(false)
const checkLoading = ref(false)

const eventType = ref<EventType>('matchup')
const leftTeam = ref('')
const rightTeam = ref('')
const creatable = ref<boolean | null>(null)
const blockReason = ref('')
const fixtureInfo = ref<WcFixtureInfo | null>(null)

const pickerVisible = ref(false)
const pickerSide = ref<PickerSide>('left')

const form = reactive({
  title: '',
  postContent: '',
  announceDate: '',
  initAmount: '',
})

const errors = reactive({
  postContent: '',
  announceDate: '',
  initAmount: '',
  match: '',
})

/** 默认近似三等分：左 34% | 平 33% | 右 33%（整数 % 无法精确 33/33/33） */
const DEFAULT_RATIO_BOUNDARY1 = 34
const DEFAULT_RATIO_BOUNDARY2 = 67

/** 第一条分界线 = 左队胜率；第二条 = 左+平累计占比 */
const ratioBoundary1 = ref(DEFAULT_RATIO_BOUNDARY1)
const ratioBoundary2 = ref(DEFAULT_RATIO_BOUNDARY2)

const ratioPercents = computed(() => {
  const left = ratioBoundary1.value
  const draw = ratioBoundary2.value - ratioBoundary1.value
  const right = 100 - ratioBoundary2.value
  return [left, draw, right]
})

// 两滑块固定 min=0 max=100，拇指位置才与色条百分比一致；边界在 handler 里约束
const onRatioBoundary1Input = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  ratioBoundary1.value = Math.min(Math.max(1, value), ratioBoundary2.value - 1)
}

const onRatioBoundary2Input = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  ratioBoundary2.value = Math.max(Math.min(99, value), ratioBoundary1.value + 1)
}

const resetRatioDefaults = () => {
  ratioBoundary1.value = DEFAULT_RATIO_BOUNDARY1
  ratioBoundary2.value = DEFAULT_RATIO_BOUNDARY2
}

const outcomeLabels = computed(() => {
  if (!leftTeam.value || !rightTeam.value) return []
  return getOutcomeLabels(leftTeam.value, rightTeam.value)
})

const autoTitle = computed(() => {
  if (!leftTeam.value || !rightTeam.value) return ''
  return getMatchTitle(leftTeam.value, rightTeam.value)
})

const pickerTeams = computed(() => {
  if (pickerSide.value === 'left') return WC_TEAMS
  if (!leftTeam.value) return []
  return getGroupMatesWithFixture(leftTeam.value)
})

const pickerTitle = computed(() =>
  pickerSide.value === 'left'
    ? t('worldCup2026.pickerTitleLeft')
    : t('worldCup2026.pickerTitleRight')
)

const canSubmit = computed(() =>
  eventType.value === 'matchup'
  && creatable.value === true
  && !!fixtureInfo.value
  && !!form.title.trim()
  && !!form.postContent.trim()
  && !!form.announceDate
  && !!form.initAmount
)

const resetMatchValidation = () => {
  creatable.value = null
  blockReason.value = ''
  fixtureInfo.value = null
  errors.match = ''
  form.announceDate = ''
}

const resetMatchState = () => {
  rightTeam.value = ''
  form.title = ''
  resetMatchValidation()
}

const openPicker = (side: PickerSide) => {
  if (createLoading.value) return
  if (side === 'right' && !leftTeam.value) {
    notify({ message: t('worldCup2026.selectLeftFirst'), type: 'info' })
    return
  }
  pickerSide.value = side
  pickerVisible.value = true
}

const onPickerSelect = (code: string, disabled?: boolean) => {
  if (disabled) return
  if (pickerSide.value === 'left') {
    if (code === rightTeam.value) {
      rightTeam.value = ''
    }
    leftTeam.value = code
    resetMatchState()
    return
  }
  if (code === leftTeam.value) return
  rightTeam.value = code
}

const checkMatchCreatable = async () => {
  if (!leftTeam.value || !rightTeam.value) return
  const tick = comStore.currentSelectedCommunity?.tick
  if (!tick) return

  checkLoading.value = true
  errors.match = ''
  resetMatchValidation()

  try {
    const res: any = await checkWorldCupMatchCreatable(tick, leftTeam.value, rightTeam.value)
    creatable.value = !!res.creatable
    if (res.fixture) {
      fixtureInfo.value = res.fixture
    }
    if (!res.creatable) {
      blockReason.value = res.reason || 'NO_FIXTURE'
      errors.match = t(`worldCup2026.reason.${blockReason.value}`)
      return
    }
    form.title = getMatchTitle(leftTeam.value, rightTeam.value)
    if (res.fixture?.kickoffUtc) {
      form.announceDate = kickoffUtcToLocalDatePicker(res.fixture.kickoffUtc)
    }
  } catch (error) {
    handleErrorTip(error)
    errors.match = t('worldCup2026.checkFailed')
  } finally {
    checkLoading.value = false
  }
}

watch(rightTeam, (code) => {
  if (!code) return
  checkMatchCreatable()
})

watch(autoTitle, (title) => {
  if (title && creatable.value) {
    form.title = title
  }
})

const onEventTypeClick = (type: EventType) => {
  if (type !== 'matchup') {
    notify({ message: t('worldCup2026.comingSoon'), type: 'info' })
    return
  }
  eventType.value = type
}

const validateForm = (): boolean => {
  errors.postContent = ''
  errors.announceDate = ''
  errors.initAmount = ''
  errors.match = ''

  if (!leftTeam.value || !rightTeam.value) {
    errors.match = t('worldCup2026.selectBothTeams')
    return false
  }
  if (creatable.value !== true || !form.title.trim()) {
    errors.match = errors.match || t('worldCup2026.selectBothTeams')
    return false
  }
  if (!form.postContent.trim()) {
    errors.postContent = t('worldCup2026.postContentRequired')
    return false
  }
  if (form.postContent.trim().length > 300) {
    errors.postContent = t('worldCup2026.postContentTooLong')
    return false
  }
  if (!form.announceDate) {
    errors.announceDate = t('createPredict.announceDateRequired')
    return false
  }
  if (new Date(form.announceDate).getTime() <= Date.now()) {
    errors.announceDate = t('createPredict.announceDateFuture')
    return false
  }
  if (!form.initAmount) {
    errors.initAmount = t('createPredict.amountRequired')
    return false
  }
  if (isNaN(Number(form.initAmount)) || Number(form.initAmount) <= 0) {
    errors.initAmount = t('createPredict.invalidAmount')
    return false
  }
  return true
}

const handleCreate = async () => {
  if (createLoading.value) return
  if (!accStore.getAccountInfo?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
  }
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }
  if (!validateForm() || !fixtureInfo.value) return

  const accInfo = accStore.getAccountInfo
  const token = comStore.currentSelectedCommunity?.token as `0x${string}`
  const tick = comStore.currentSelectedCommunity?.tick ?? ''

  createLoading.value = true
  try {
    const balance = await getTokenBalance(token)
    if (balance < parseUnits(form.initAmount.toString(), 18)) {
      notify({ message: t('errMessage.insufficientBalance'), type: 'info' })
      return
    }

    // 发推正文由用户填写；服务端仅补充社区 #tick，不再追加 #TagAI
    const text = form.postContent.trim()
    const outcomes = getOutcomeLabels(leftTeam.value, rightTeam.value)
    // 滑杆展示的是目标边际概率；链上 hint 需按 FPMM 公式换算储备比例
    const distributionHint = targetPercentsToDistributionHint(ratioPercents.value)

    modalStore.setModalCloseEnable(false)
    const preMarketData: any = await preCreateFPMMMarketEvent({
      twitterId: accInfo.twitterId,
      tick,
      title: form.title.trim(),
      text,
      outcomes,
      distributionHint,
    })

    let { questionId, needOP, feePath } = preMarketData
    if (feePath && typeof feePath === 'string') {
      feePath = JSON.parse(feePath)
    }

    if (!(await preCheckCuration(OperateType.CREATE_PREDICT, undefined, needOP))) {
      notify({ message: t('errMessage.insufficientOp'), type: 'info' })
      return
    }

    await approveToken(FPMMDeterministicFactoryEventV2, token, parseUnits(form.initAmount.toString(), 18))

    const endTime = Math.floor(new Date(form.announceDate).getTime() / 1000)
    const { hash } = await createEventMarketV2(
      questionId,
      token,
      feePath ?? [],
      distributionHint,
      3,
      endTime,
      parseUnits(form.initAmount.toString(), 18)
    )

    await createFPMMMarketForEvent(accInfo.twitterId, questionId, hash)
    modalStore.setModalVisible(false)
    emitter.emit('createPredictSuccess')
  } catch (error) {
    handleErrorTip(error)
  } finally {
    modalStore.setModalCloseEnable(true)
    createLoading.value = false
  }
}

/** 供 CreatePredictModal 关闭时重置表单 */
const resetForm = () => {
  eventType.value = 'matchup'
  leftTeam.value = ''
  resetMatchState()
  form.initAmount = ''
  errors.announceDate = ''
  errors.initAmount = ''
  pickerVisible.value = false
  resetRatioDefaults()
}

defineExpose({
  resetForm,
  createLoading,
})

onMounted(async () => {
  if (comStore.currentSelectedCommunity?.token) {
    userBalance.value =
      Number(await getTokenBalance(comStore.currentSelectedCommunity.token as `0x${string}`)) / 1e18
  }
})
</script>

<template>
  <div class="create-wc-predict-form">
    <!-- 赛事类型 -->
    <div class="wc-event-types">
      <button
        type="button"
        class="wc-event-types__item wc-event-types__item--active"
        @click="onEventTypeClick('matchup')"
      >
        {{ $t('worldCup2026.eventType.matchup') }}
      </button>
      <button
        type="button"
        class="wc-event-types__item wc-event-types__item--disabled"
        @click="onEventTypeClick('groupChampion')"
      >
        {{ $t('worldCup2026.eventType.groupChampion') }}
      </button>
      <button
        type="button"
        class="wc-event-types__item wc-event-types__item--disabled"
        @click="onEventTypeClick('worldChampion')"
      >
        {{ $t('worldCup2026.eventType.worldChampion') }}
      </button>
    </div>

    <!-- 对阵选择：左 | VS | 右 -->
    <div class="wc-matchup">
      <button
        type="button"
        class="wc-matchup__side"
        :class="{ 'wc-matchup__side--filled': leftTeam }"
        @click="openPicker('left')"
      >
        <img
          v-if="leftTeam"
          :src="getTeamFlagUrl(leftTeam, 80)"
          :alt="getTeamName(leftTeam)"
          class="wc-matchup__flag"
        />
        <div v-else class="wc-matchup__placeholder">
          <span class="wc-matchup__plus">+</span>
        </div>
        <span class="wc-matchup__name">
          {{ leftTeam ? getTeamName(leftTeam) : $t('worldCup2026.tapToSelect') }}
        </span>
      </button>

      <div class="wc-matchup__vs">VS</div>

      <button
        type="button"
        class="wc-matchup__side"
        :class="{ 'wc-matchup__side--filled': rightTeam, 'wc-matchup__side--muted': !leftTeam }"
        @click="openPicker('right')"
      >
        <img
          v-if="rightTeam"
          :src="getTeamFlagUrl(rightTeam, 80)"
          :alt="getTeamName(rightTeam)"
          class="wc-matchup__flag"
        />
        <div v-else class="wc-matchup__placeholder">
          <span class="wc-matchup__plus">+</span>
        </div>
        <span class="wc-matchup__name">
          {{ rightTeam ? getTeamName(rightTeam) : $t('worldCup2026.tapToSelect') }}
        </span>
      </button>
    </div>

    <div v-if="checkLoading" class="wc-status wc-status--loading">
      <i-ep-loading class="animate-spin" />
      {{ $t('worldCup2026.checking') }}
    </div>
    <div v-else-if="errors.match" class="wc-status wc-status--error">{{ errors.match }}</div>
    <div v-else-if="fixtureInfo" class="wc-status wc-status--ok">
      {{ $t('worldCup2026.fixtureVenue', { venue: fixtureInfo.venue }) }}
      · {{ formatKickoffUtcToLocal(fixtureInfo.kickoffUtc) }}
    </div>

    <!-- 自动标题（只读） -->
    <div class="wc-field">
      <label class="wc-field__label">
        {{ $t('createPredict.titleLabel') }}
        <span class="text-red-500">*</span>
      </label>
      <input
        :value="form.title"
        type="text"
        readonly
        class="wc-field__input wc-field__input--readonly"
        :placeholder="$t('worldCup2026.titleAutoPlaceholder')"
      />
      <div class="wc-field__hint">{{ form.title.length }}/100 {{ $t('createPredict.characters') }}</div>
    </div>

    <!-- 发推内容（用户自行填写，API 代发） -->
    <div class="wc-field">
      <label class="wc-field__label">
        {{ $t('worldCup2026.postContentLabel') }}
        <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="form.postContent"
        rows="4"
        maxlength="300"
        class="wc-field__input resize-none min-h-[96px]"
        :class="{ 'border-red-500': errors.postContent }"
        :placeholder="$t('worldCup2026.postContentPlaceholder')"
      />
      <div v-if="errors.postContent" class="wc-field__error">{{ errors.postContent }}</div>
      <div v-else class="wc-field__hint text-grey-normal">
        {{ form.postContent.length }}/300 {{ $t('createPredict.characters') }}
      </div>
    </div>

    <!-- 截止时间 -->
    <div class="wc-field">
      <label class="wc-field__label">
        {{ $t('createPredict.announceDateLabel') }}
        <span class="text-red-500">*</span>
      </label>
      <el-date-picker
        v-model="form.announceDate"
        type="datetime"
        :placeholder="$t('createPredict.announceDatePlaceholder')"
        class="w-full !w-full"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        :disabled="!canSubmit && !form.announceDate"
        :class="{ 'border-red-500': errors.announceDate }"
      />
      <div v-if="errors.announceDate" class="wc-field__error">{{ errors.announceDate }}</div>
      <div v-else class="wc-field__hint text-grey-normal">{{ $t('worldCup2026.kickoffHint') }}</div>
    </div>

    <!-- 初始概率（双滑块拖动调整三等分） -->
    <div class="wc-field">
      <div class="flex items-center justify-between mb-2">
        <label class="wc-field__label mb-0 flex items-center gap-1">
          {{ $t('worldCup2026.initialRatio') }}
          <span class="text-red-500">*</span>
          <el-tooltip effect="dark" :content="$t('worldCup2026.initialRatioTip')" placement="top">
            <button type="button" class="wc-ratio-tip">?</button>
          </el-tooltip>
        </label>
        <span class="text-sm font-medium text-black">
          <span class="text-red-500">{{ ratioPercents[0] }}%</span>
          /
          <span class="text-gray-500">{{ ratioPercents[1] }}%</span>
          /
          <span class="text-blue-500">{{ ratioPercents[2] }}%</span>
        </span>
      </div>

      <!-- 色条与滑块同容器叠加，避免拖动点与分段边界错位 -->
      <div class="wc-ratio-track">
        <div class="wc-ratio-bar" aria-hidden="true">
          <div class="wc-ratio-bar__seg wc-ratio-bar__seg--left" :style="{ width: `${ratioPercents[0]}%` }" />
          <div class="wc-ratio-bar__seg wc-ratio-bar__seg--draw" :style="{ width: `${ratioPercents[1]}%` }" />
          <div class="wc-ratio-bar__seg wc-ratio-bar__seg--right" :style="{ width: `${ratioPercents[2]}%` }" />
        </div>
        <div class="wc-ratio-slider">
          <input
            type="range"
            class="wc-ratio-slider__input wc-ratio-slider__input--first"
            min="0"
            max="100"
            :value="ratioBoundary1"
            @input="onRatioBoundary1Input"
          />
          <input
            type="range"
            class="wc-ratio-slider__input wc-ratio-slider__input--second"
            min="0"
            max="100"
            :value="ratioBoundary2"
            @input="onRatioBoundary2Input"
          />
        </div>
      </div>

      <div v-if="outcomeLabels.length" class="wc-ratio-labels">
        <span v-for="(label, idx) in outcomeLabels" :key="idx" class="wc-ratio-labels__item">
          {{ label }}
        </span>
      </div>
    </div>

    <!-- 注入资金 -->
    <div class="wc-field">
      <label class="wc-field__label">
        {{ $t('createPredict.initAmount') }}
        <span class="text-red-500">*</span>
      </label>
      <div class="relative">
        <input
          v-model="form.initAmount"
          type="number"
          step="0.0001"
          min="0"
          :placeholder="$t('createPredict.amountPlaceholder')"
          class="wc-field__input pr-20"
          :class="{ 'border-red-500': errors.initAmount }"
        />
        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-grey-normal text-sm">
          {{ comStore.currentSelectedCommunity?.tick }}
        </span>
      </div>
      <div class="flex justify-between mt-1">
        <span v-if="errors.initAmount" class="wc-field__error">{{ errors.initAmount }}</span>
        <span class="text-grey-normal text-xs ml-auto">
          {{ $t('balance') }}: {{ formatAmount(userBalance) }} {{ comStore.currentSelectedCommunity?.tick }}
        </span>
      </div>
    </div>

    <div class="mt-8">
      <button
        type="button"
        class="wc-submit"
        :disabled="createLoading || accountMismatch || !canSubmit"
        @click="handleCreate"
      >
        <i-ep-loading v-if="createLoading" class="animate-spin" />
        <span>{{ accStore.ethConnectAddress ? $t('worldCup2026.create') : $t('connect') }}</span>
      </button>
      <span v-if="accountMismatch" class="text-red-e6 text-sm text-center block mt-2">
        {{ $t('web3.addressMismatch', { address: accStore.getAccountInfo?.ethAddr }) }}
      </span>
      <span v-if="createLoading" class="text-red-e6 text-sm text-center block mt-2">
        {{ $t('createPredict.creatingTip') }}
      </span>
    </div>

    <WorldCupTeamPicker
      v-model:visible="pickerVisible"
      :title="pickerTitle"
      :teams="pickerTeams"
      :selected-code="pickerSide === 'left' ? leftTeam : rightTeam"
      @select="onPickerSelect"
    />
  </div>
</template>

<style scoped>
.wc-event-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.wc-event-types__item {
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid #111;
  background: #fff;
  color: #111;
  transition: opacity 0.15s;
}

.wc-event-types__item--active {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.wc-event-types__item--disabled {
  border-style: dashed;
  border-color: #d1d5db;
  color: #9ca3af;
}

.wc-matchup {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.wc-matchup__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px;
  border: 1.5px dashed #d1d5db;
  border-radius: 16px;
  background: #fafafa;
  min-height: 120px;
  transition: border-color 0.15s, background 0.15s;
}

.wc-matchup__side:hover:not(.wc-matchup__side--muted) {
  border-color: #fe913f;
  background: #fffaf5;
}

.wc-matchup__side--filled {
  border-style: solid;
  border-color: #e5e7eb;
  background: #fff;
}

.wc-matchup__side--muted {
  opacity: 0.55;
  cursor: not-allowed;
}

.wc-matchup__flag {
  width: 56px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.wc-matchup__placeholder {
  width: 56px;
  height: 40px;
  border-radius: 6px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wc-matchup__plus {
  font-size: 22px;
  color: #9ca3af;
  line-height: 1;
}

.wc-matchup__name {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  text-align: center;
  line-height: 1.3;
  word-break: break-word;
}

.wc-matchup__vs {
  font-size: 22px;
  font-weight: 800;
  color: #111;
  letter-spacing: 0.02em;
}

.wc-status {
  font-size: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 10px;
}

.wc-status--loading {
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f9fafb;
}

.wc-status--error {
  color: #ef4444;
  background: #fef2f2;
}

.wc-status--ok {
  color: #6b7280;
  background: #f9fafb;
}

.wc-field {
  margin-bottom: 18px;
}

.wc-field__label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #111;
  margin-bottom: 8px;
}

.wc-field__input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.wc-field__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.wc-field__input--readonly {
  background: #f9fafb;
  color: #374151;
  cursor: default;
}

.wc-field__hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 6px;
}

.wc-field__error {
  font-size: 12px;
  color: #ef4444;
  margin-top: 6px;
}

.wc-ratio-track {
  position: relative;
  height: 20px;
  margin-bottom: 8px;
}

.wc-ratio-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: #f3f4f6;
  pointer-events: none;
}

.wc-ratio-slider {
  position: absolute;
  inset: 0;
}

.wc-ratio-slider__input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 20px;
  margin: 0;
  background: transparent;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
}

.wc-ratio-slider__input--first {
  z-index: 2;
}

.wc-ratio-slider__input--second {
  z-index: 3;
}

.wc-ratio-slider__input::-webkit-slider-runnable-track {
  height: 10px;
  background: transparent;
  border: none;
}

.wc-ratio-slider__input::-moz-range-track {
  height: 10px;
  background: transparent;
  border: none;
}

.wc-ratio-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: all;
  width: 18px;
  height: 18px;
  margin-top: -4px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: grab;
}

.wc-ratio-slider__input::-moz-range-thumb {
  pointer-events: all;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: grab;
}

.wc-ratio-slider__input--first::-webkit-slider-thumb {
  border-color: #ef4444;
}

.wc-ratio-slider__input--second::-webkit-slider-thumb {
  border-color: #3b82f6;
}

.wc-ratio-slider__input--first::-moz-range-thumb {
  border-color: #ef4444;
}

.wc-ratio-slider__input--second::-moz-range-thumb {
  border-color: #3b82f6;
}

.wc-ratio-tip {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.wc-ratio-bar__seg {
  min-width: 4px;
  transition: width 0.2s;
}

.wc-ratio-bar__seg--left {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.wc-ratio-bar__seg--draw {
  background: linear-gradient(90deg, #d1d5db, #e5e7eb);
}

.wc-ratio-bar__seg--right {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.wc-ratio-labels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.wc-ratio-labels__item {
  font-size: 10px;
  color: #6b7280;
  text-align: center;
  line-height: 1.3;
  word-break: break-word;
}

.wc-submit {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #fe913f 0%, #e58339 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s;
}

.wc-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.el-input__wrapper) {
  padding: 11px 16px;
  border-radius: 12px;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset !important;
}
</style>
