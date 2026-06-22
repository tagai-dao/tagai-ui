<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseUnits } from 'viem'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip, notify } from '@/utils/notify'
import { GlobalModalType } from '@/types'
import {
  checkWorldCupMatchCreatable,
  checkWorldCupChampionCreatable,
  createFPMMMarketForEvent,
  preCreateFPMMMarketEvent,
} from '@/apis/api'
import { OperateType, useTweet } from '@/composables/useTweet'
import { useAccount } from '@/composables/useAccount'
import { useWorldCupTeam } from '@/composables/useWorldCupTeam'
import { useChampionOddsEditor } from '@/composables/useChampionOddsEditor'
import emitter from '@/utils/emitter'
import { getTokenBalance } from '@/utils/web3'
import { formatAmount } from '@/utils/helper'
import { approveToken, createEventMarket, type EventMarketDexConfig } from '@/utils/fpmm'
import { targetPercentsToDistributionHint } from '@/composables/useEventMarketOutcomes'
import { FPMMDeterministicFactoryEventV3 } from '@/config'
import { WC_TEAMS } from '@/data/world-cup-2026/teams'
import { WC_TOP_TEAM_CODES, WC_CHAMPION_OUTCOME_COUNT } from '@/data/world-cup-2026/top-teams'
import {
  formatKickoffUtcToLocal,
  getGroupMates,
  getGroupMatesWithFixture,
  kickoffUtcToLocalDatePicker,
  type WcTeamWithFixture,
} from '@/data/world-cup-2026/helpers'
import WorldCupTeamPicker from '@/components/common/WorldCupTeamPicker.vue'
import WorldCupChampionOddsEditor from '@/components/common/WorldCupChampionOddsEditor.vue'

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

const emit = defineEmits<{ created: [] }>()

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
const championCreatable = ref<boolean | null>(null)
const blockReason = ref('')
const fixtureInfo = ref<WcFixtureInfo | null>(null)
const championEditor = useChampionOddsEditor()
const { percents: championPercents, lastPercent: championLastPercent } = championEditor

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
  if (eventType.value === 'worldChampion') return t('worldCup2026.championTitle')
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

const canSubmit = computed(() => {
  if (eventType.value === 'worldChampion') {
    return championCreatable.value === true
      && !!form.title.trim()
      && !!form.postContent.trim()
      && !!form.announceDate
      && !!form.initAmount
      && championEditor.valid.value
  }
  return eventType.value === 'matchup'
    && creatable.value === true
    && !!fixtureInfo.value
    && !!form.title.trim()
    && !!form.postContent.trim()
    && !!form.announceDate
    && !!form.initAmount
})

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

const checkChampionCreatable = async () => {
  const tick = comStore.currentSelectedCommunity?.tick
  if (!tick) return

  checkLoading.value = true
  errors.match = ''

  try {
    const res: any = await checkWorldCupChampionCreatable(tick)
    championCreatable.value = !!res.creatable
    if (!res.creatable) {
      blockReason.value = res.reason || 'CHAMPION_EXISTS'
      errors.match = t(`worldCup2026.reason.${blockReason.value}`)
      return
    }
    form.title = t('worldCup2026.championTitle')
  } catch (error) {
    handleErrorTip(error)
    errors.match = t('worldCup2026.checkFailed')
  } finally {
    checkLoading.value = false
  }
}

watch(autoTitle, (title) => {
  if (!title) return
  if (eventType.value === 'worldChampion') {
    form.title = title
  } else if (creatable.value) {
    form.title = title
  }
})

watch(eventType, (type) => {
  errors.match = ''
  blockReason.value = ''
  if (type === 'worldChampion') {
    championCreatable.value = null
    form.title = t('worldCup2026.championTitle')
    checkChampionCreatable()
  } else {
    championCreatable.value = null
  }
})

watch(() => comStore.currentSelectedCommunity?.tick, () => {
  if (eventType.value === 'worldChampion') {
    checkChampionCreatable()
  }
})

const onEventTypeClick = (type: EventType) => {
  if (type === 'groupChampion') {
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

  if (eventType.value === 'worldChampion') {
    if (championCreatable.value !== true || !form.title.trim()) {
      errors.match = errors.match || t('worldCup2026.reason.CHAMPION_EXISTS')
      return false
    }
    if (!championEditor.valid.value) {
      errors.match = t('worldCup2026.initialRatio')
      return false
    }
  } else {
    if (!leftTeam.value || !rightTeam.value) {
      errors.match = t('worldCup2026.selectBothTeams')
      return false
    }
    if (creatable.value !== true || !form.title.trim()) {
      errors.match = errors.match || t('worldCup2026.selectBothTeams')
      return false
    }
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
  if (!validateForm()) return
  if (eventType.value === 'matchup' && !fixtureInfo.value) return

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

    // 按赛事类型构建 outcomes / 链上 distributionHint / eventTag / 默认 outcome 数
    let outcomes: string[]
    let distributionHint: number[]
    let eventTag: string
    let defaultOutcomeCount: number

    if (eventType.value === 'worldChampion') {
      outcomes = WC_TOP_TEAM_CODES.map(code =>
        t('worldCup2026.outcome.champion', { team: getTeamName(code) }),
      )
      distributionHint = championEditor.distributionHint.value
      eventTag = '2026FWC-Champion'
      defaultOutcomeCount = WC_CHAMPION_OUTCOME_COUNT
    } else {
      outcomes = getOutcomeLabels(leftTeam.value, rightTeam.value)
      // 滑杆展示的是目标边际概率；链上 hint 需按 FPMM 公式换算储备比例
      distributionHint = targetPercentsToDistributionHint(ratioPercents.value)
      eventTag = '2026FWC-GS'
      defaultOutcomeCount = 3
    }

    modalStore.setModalCloseEnable(false)
    const preMarketData: any = await preCreateFPMMMarketEvent({
      twitterId: accInfo.twitterId,
      tick,
      title: form.title.trim(),
      text,
      outcomes,
      distributionHint,
      eventTag,
    })

    let { questionId, needOP, feePath, outcomeCount, distributionHint: hintFromApi, feeDexVersion, feeQuoteTarget, feePoolId } = preMarketData
    if (feePath && typeof feePath === 'string') {
      feePath = JSON.parse(feePath)
    }

    if (!(await preCheckCuration(OperateType.CREATE_PREDICT, undefined, needOP))) {
      notify({ message: t('errMessage.insufficientOp'), type: 'info' })
      return
    }

    const dexConfig: EventMarketDexConfig = {
      feeDexVersion: Number(feeDexVersion ?? 2),
      feeQuoteTarget: (feeQuoteTarget ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      feePoolId: (feePoolId ?? '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
      feePath: (feePath ?? []) as `0x${string}`[],
    }

    await approveToken(FPMMDeterministicFactoryEventV3, token, parseUnits(form.initAmount.toString(), 18))

    const endTime = Math.floor(new Date(form.announceDate).getTime() / 1000)
    const { hash } = await createEventMarket(
      questionId,
      token,
      hintFromApi ?? distributionHint,
      outcomeCount ?? defaultOutcomeCount,
      endTime,
      parseUnits(form.initAmount.toString(), 18),
      dexConfig,
    )

    await createFPMMMarketForEvent(accInfo.twitterId, questionId, hash)
    createLoading.value = false
    clearDraft()
    emit('created')
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
  championCreatable.value = null
  championEditor.clearAll()
  clearDraft()
}

defineExpose({
  resetForm,
  createLoading,
})

// === 草稿缓存：填写中自动保存，再次打开自动回填，创建成功/重置时清除 ===
const DRAFT_KEY_PREFIX = 'wcPredictDraft:'

const draftKey = computed(() => {
  const tid = accStore.getAccountInfo?.twitterId
  return tid ? `${DRAFT_KEY_PREFIX}${tid}` : ''
})

type WcDraft = {
  eventType: EventType
  leftTeam: string
  rightTeam: string
  ratioBoundary1: number
  ratioBoundary2: number
  championPercents: number[]
  postContent: string
  announceDate: string
  initAmount: string
}

const saveDraft = () => {
  const key = draftKey.value
  if (!key) return
  const draft: WcDraft = {
    eventType: eventType.value,
    leftTeam: leftTeam.value,
    rightTeam: rightTeam.value,
    ratioBoundary1: ratioBoundary1.value,
    ratioBoundary2: ratioBoundary2.value,
    championPercents: [...championEditor.percents.value],
    postContent: form.postContent,
    announceDate: form.announceDate,
    initAmount: form.initAmount,
  }
  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    /* ignore quota errors */
  }
}

const clearDraft = () => {
  const key = draftKey.value
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const restoreDraft = () => {
  const key = draftKey.value
  if (!key) return
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return
  }
  if (!raw) return
  let draft: WcDraft
  try {
    draft = JSON.parse(raw) as WcDraft
  } catch {
    clearDraft()
    return
  }
  // championPercents 长度需与当前 top-32 一致，否则丢弃（队伍清单变更兜底）
  if (!Array.isArray(draft.championPercents) || draft.championPercents.length !== championEditor.percents.value.length) {
    draft.championPercents = championEditor.percents.value
  }
  eventType.value = draft.eventType
  leftTeam.value = draft.leftTeam
  rightTeam.value = draft.rightTeam
  ratioBoundary1.value = draft.ratioBoundary1
  ratioBoundary2.value = draft.ratioBoundary2
  championEditor.percents.value = [...draft.championPercents]
  form.postContent = draft.postContent
  form.announceDate = draft.announceDate
  form.initAmount = draft.initAmount
  // matchup 恢复后需重新校验 fixture（checkMatchCreatable 由 watch(rightTeam) 触发，
  // 但若 rightTeam 已就位，手动补一次校验以回填 fixtureInfo）
  if (draft.eventType === 'matchup' && leftTeam.value && rightTeam.value) {
    nextTick(() => checkMatchCreatable())
  } else if (draft.eventType === 'worldChampion') {
    nextTick(() => checkChampionCreatable())
  }
}

// 表单状态变化时自动保存草稿（深度监听）
watch(
  [eventType, leftTeam, rightTeam, ratioBoundary1, ratioBoundary2, () => championEditor.percents.value, () => form.postContent, () => form.announceDate, () => form.initAmount],
  saveDraft,
  { deep: true },
)

onMounted(async () => {
  if (comStore.currentSelectedCommunity?.token) {
    userBalance.value =
      Number(await getTokenBalance(comStore.currentSelectedCommunity.token as `0x${string}`)) / 1e18
  }
  restoreDraft()
})
</script>

<template>
  <div class="create-wc-predict-form">
    <!-- 赛事类型 -->
    <div class="wc-event-types">
      <button
        type="button"
        class="wc-event-types__item"
        :class="{ 'wc-event-types__item--active': eventType === 'matchup' }"
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
        class="wc-event-types__item"
        :class="{ 'wc-event-types__item--active': eventType === 'worldChampion' }"
        @click="onEventTypeClick('worldChampion')"
      >
        {{ $t('worldCup2026.eventType.worldChampion') }}
      </button>
    </div>

    <!-- 对阵选择：左 | VS | 右 -->
    <div v-if="eventType === 'matchup'" class="wc-matchup">
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
    <div v-else-if="eventType === 'matchup' && fixtureInfo" class="wc-status wc-status--ok">
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
        :disabled="eventType === 'matchup' && !canSubmit && !form.announceDate"
        :class="{ 'border-red-500': errors.announceDate }"
      />
      <div v-if="errors.announceDate" class="wc-field__error">{{ errors.announceDate }}</div>
      <div v-else class="wc-field__hint text-grey-normal">
        {{ eventType === 'worldChampion' ? $t('worldCup2026.championDeadlineHint') : $t('worldCup2026.kickoffHint') }}
      </div>
    </div>

    <!-- 初始概率（双滑块拖动调整三等分，仅 matchup） -->
    <div v-if="eventType === 'matchup'" class="wc-field">
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

    <!-- 初始赔率（冠军市场：逐队权重编辑） -->
    <div v-if="eventType === 'worldChampion'" class="wc-field">
      <WorldCupChampionOddsEditor
        :percents="championPercents"
        :last-percent="championLastPercent"
        @clear="championEditor.clearAll"
        @equal="championEditor.equalSplit"
        @favorites="championEditor.applyFavoritesPreset"
      />
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
      v-if="eventType === 'matchup'"
      v-model:visible="pickerVisible"
      :title="pickerTitle"
      :teams="pickerTeams"
      :selected-code="pickerSide === 'left' ? leftTeam : rightTeam"
      :grouped="pickerSide === 'left'"
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
  border: 1.5px solid var(--text-base);
  background: var(--surface);
  color: var(--text-base);
  transition: opacity 0.15s;
}

.wc-event-types__item--active {
  background: var(--surface);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.wc-event-types__item--disabled {
  border-style: dashed;
  border-color: var(--border-base);
  color: var(--text-faint);
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
  border: 1.5px dashed var(--border-base);
  border-radius: 16px;
  background: var(--surface-2);
  min-height: 120px;
  transition: border-color 0.15s, background 0.15s;
}

.wc-matchup__side:hover:not(.wc-matchup__side--muted) {
  border-color: #fe913f;
  background: var(--surface);
}

.wc-matchup__side--filled {
  border-style: solid;
  border-color: var(--border-base);
  background: var(--surface);
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
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wc-matchup__plus {
  font-size: 22px;
  color: var(--text-faint);
  line-height: 1;
}

.wc-matchup__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-base);
  text-align: center;
  line-height: 1.3;
  word-break: break-word;
}

.wc-matchup__vs {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-base);
  letter-spacing: 0.02em;
}

.wc-status {
  font-size: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 10px;
}

.wc-status--loading {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
}

.wc-status--error {
  color: #ef4444;
  background: var(--surface-2);
}

.wc-status--ok {
  color: var(--text-muted);
  background: var(--surface-2);
}

.wc-field {
  margin-bottom: 18px;
}

.wc-field__label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-base);
  margin-bottom: 8px;
}

.wc-field__input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-base);
  background-color: var(--surface);
  outline: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.wc-field__input::placeholder {
  color: var(--text-faint);
}

.wc-field__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.wc-field__input--readonly {
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: default;
}

.wc-field__hint {
  font-size: 11px;
  color: var(--text-faint);
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
  background: var(--surface-2);
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
  background: var(--surface-2);
  color: var(--text-faint);
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
  color: var(--text-muted);
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
  box-shadow: 0 0 0 1px var(--border-base) inset;
  background-color: var(--surface);
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset !important;
}

:deep(.el-input__inner) {
  color: var(--text-base) !important;
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-faint) !important;
}
</style>
