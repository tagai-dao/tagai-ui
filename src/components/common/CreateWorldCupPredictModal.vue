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
import { FPMMDeterministicFactoryEventV2 } from '@/config'
import { WC_TEAMS } from '@/data/world-cup-2026/teams'
import {
  DEFAULT_WC_DISTRIBUTION_HINT,
  buildWorldCupMetaJson,
  getGroupMates,
} from '@/data/world-cup-2026/helpers'

type WcFixtureInfo = {
  fixtureId: string
  group: string
  teamA: string
  teamB: string
  kickoffUtc: string
  venue: string
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

const { t } = useI18n()
const { preCheckCuration } = useTweet()
const { getTeamName, getMatchTitle, getOutcomeLabels } = useWorldCupTeam()
const accStore = useAccountStore()
const modalStore = useModalStore()
const comStore = useCommunityStore()
const { accountMismatch } = useAccount()

const userBalance = ref(0)
const createLoading = ref(false)
const checkLoading = ref(false)

const leftTeam = ref('')
const rightTeam = ref('')
const creatable = ref<boolean | null>(null)
const blockReason = ref('')
const fixtureInfo = ref<WcFixtureInfo | null>(null)

const form = reactive({
  title: '',
  announceDate: '',
  initAmount: '',
})

const errors = reactive({
  title: '',
  announceDate: '',
  initAmount: '',
  match: '',
})

const outcomeLabels = computed(() => {
  if (!leftTeam.value || !rightTeam.value) return []
  return getOutcomeLabels(leftTeam.value, rightTeam.value)
})

const teamsByGroup = computed(() =>
  GROUPS.map(group => ({
    group,
    teams: WC_TEAMS.filter(team => team.group === group),
  }))
)

const opponentTeams = computed(() =>
  leftTeam.value ? getGroupMates(leftTeam.value) : []
)

const canShowForm = computed(() => creatable.value === true && !!fixtureInfo.value)

/** ISO → el-date-picker 本地时间字符串 */
const kickoffUtcToLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const resetMatchState = () => {
  rightTeam.value = ''
  creatable.value = null
  blockReason.value = ''
  fixtureInfo.value = null
  errors.match = ''
  form.title = ''
  form.announceDate = ''
}

const selectLeftTeam = (code: string) => {
  if (createLoading.value) return
  leftTeam.value = code
  resetMatchState()
}

const checkMatchCreatable = async () => {
  if (!leftTeam.value || !rightTeam.value) return
  const tick = comStore.currentSelectedCommunity?.tick
  if (!tick) return

  checkLoading.value = true
  errors.match = ''
  creatable.value = null
  fixtureInfo.value = null
  blockReason.value = ''

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
      form.announceDate = kickoffUtcToLocalInput(res.fixture.kickoffUtc)
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

const validateForm = (): boolean => {
  errors.title = ''
  errors.announceDate = ''
  errors.initAmount = ''
  errors.match = ''

  if (!leftTeam.value || !rightTeam.value) {
    errors.match = t('worldCup2026.selectBothTeams')
    return false
  }
  if (creatable.value !== true) {
    errors.match = errors.match || t('worldCup2026.selectBothTeams')
    return false
  }

  if (!form.title.trim()) {
    errors.title = t('createPredict.titleRequired')
    return false
  }
  if (form.title.trim().length < 3) {
    errors.title = t('createPredict.titleTooShort')
    return false
  }
  if (form.title.trim().length > 100) {
    errors.title = t('createPredict.titleTooLong')
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

    modalStore.setModalCloseEnable(false)
    await approveToken(FPMMDeterministicFactoryEventV2, token, parseUnits(form.initAmount.toString(), 18))

    const metaJson = buildWorldCupMetaJson({
      fixtureId: fixtureInfo.value.fixtureId,
      group: fixtureInfo.value.group,
      leftTeam: leftTeam.value,
      rightTeam: rightTeam.value,
    })
    const text = `${form.title.trim()}\n${metaJson}`
    const outcomes = getOutcomeLabels(leftTeam.value, rightTeam.value)
    const distributionHint = [...DEFAULT_WC_DISTRIBUTION_HINT]

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

const closeModal = () => {
  if (createLoading.value) return
  modalStore.setModalVisible(false)
  leftTeam.value = ''
  resetMatchState()
  form.initAmount = ''
  errors.title = ''
  errors.announceDate = ''
  errors.initAmount = ''
}

onMounted(async () => {
  if (comStore.currentSelectedCommunity?.token) {
    userBalance.value =
      Number(await getTokenBalance(comStore.currentSelectedCommunity.token as `0x${string}`)) / 1e18
  }
})
</script>

<template>
  <div class="create-wc-predict-modal relative max-h-[80vh] overflow-y-auto">
    <img
      class="absolute top-0 right-0 cursor-pointer w-6 h-6 hover:opacity-70 transition-opacity z-10"
      src="~@/assets/icons/icon-modal-close.svg"
      alt="Close"
      @click="closeModal"
    />

    <h2 class="text-lg font-bold text-black mb-2 pr-8">{{ $t('worldCup2026.title') }}</h2>
    <p class="text-grey-normal text-sm mb-4">{{ $t('worldCup2026.subtitle') }}</p>

    <!-- 选主队（左） -->
    <div class="mb-4">
      <label class="block text-sm font-medium text-black mb-2">{{ $t('worldCup2026.selectLeftTeam') }}</label>
      <div class="space-y-3 max-h-40 overflow-y-auto pr-1">
        <div v-for="groupItem in teamsByGroup" :key="groupItem.group">
          <div class="text-xs text-grey-normal mb-1">{{ $t('worldCup2026.groupLabel', { group: groupItem.group }) }}</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="team in groupItem.teams"
              :key="team.code"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
              :class="leftTeam === team.code
                ? 'bg-orange-normal text-white border-orange-normal'
                : 'bg-white text-grey-normal border-grey-light hover:border-orange-normal'"
              @click="selectLeftTeam(team.code)"
            >
              {{ getTeamName(team.code) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 选对手（右） -->
    <div v-if="leftTeam" class="mb-4">
      <label class="block text-sm font-medium text-black mb-2">
        {{ $t('worldCup2026.selectOpponent') }}
        <span class="text-grey-normal font-normal ml-1">({{ getTeamName(leftTeam) }})</span>
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="team in opponentTeams"
          :key="team.code"
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
          :class="rightTeam === team.code
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-white text-black border-grey-light hover:border-blue-400'"
          @click="rightTeam = team.code"
        >
          {{ getTeamName(team.code) }}
        </button>
      </div>
      <div v-if="checkLoading" class="text-sm text-grey-normal mt-2 flex items-center gap-1">
        <i-ep-loading class="animate-spin" /> {{ $t('worldCup2026.checking') }}
      </div>
      <div v-if="errors.match" class="text-red-500 text-sm mt-2">{{ errors.match }}</div>
    </div>

    <!-- 表单：校验通过后展示 -->
    <div v-if="canShowForm" class="space-y-4 border-t border-grey-light pt-4">
      <div v-if="fixtureInfo" class="text-xs text-grey-normal bg-gray-50 rounded-lg p-3">
        <div>{{ $t('worldCup2026.fixtureVenue', { venue: fixtureInfo.venue }) }}</div>
        <div class="mt-1">{{ $t('worldCup2026.kickoffHint') }}</div>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">
          {{ $t('createPredict.titleLabel') }}
          <span class="text-red-500">*</span>
        </label>
        <input
          v-model="form.title"
          type="text"
          maxlength="100"
          class="w-full px-4 py-3 border rounded-xl text-base border-grey-light focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="{ 'border-red-500': errors.title }"
        />
        <div v-if="errors.title" class="text-red-500 text-sm mt-1">{{ errors.title }}</div>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">
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
          :class="{ 'border-red-500': errors.announceDate }"
        />
        <div v-if="errors.announceDate" class="text-red-500 text-sm mt-1">{{ errors.announceDate }}</div>
      </div>

      <!-- 三均分 outcome 展示（只读） -->
      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ $t('worldCup2026.initialRatio') }}</label>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="(label, idx) in outcomeLabels"
            :key="idx"
            class="rounded-xl bg-gray-100 px-2 py-3 text-center text-xs font-medium text-black"
          >
            <div class="text-grey-normal mb-1">33%</div>
            <div class="line-clamp-2">{{ label }}</div>
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">
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
            class="w-full px-4 py-3 border rounded-xl text-base border-grey-light pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="{ 'border-red-500': errors.initAmount }"
          />
          <span class="absolute right-4 top-1/2 -translate-y-1/2 text-grey-normal text-sm">{{ comStore.currentSelectedCommunity?.tick }}</span>
        </div>
        <div class="flex justify-between mt-1">
          <span v-if="errors.initAmount" class="text-red-500 text-sm">{{ errors.initAmount }}</span>
          <span class="text-grey-normal text-xs ml-auto">
            {{ $t('balance') }}: {{ formatAmount(userBalance) }} {{ comStore.currentSelectedCommunity?.tick }}
          </span>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <button
        type="button"
        class="w-full h-12 bg-gradient-primary text-white font-bold rounded-full text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="createLoading || accountMismatch || !canShowForm"
        @click="handleCreate"
      >
        <i-ep-loading v-if="createLoading" class="animate-spin" />
        <span>{{ accStore.ethConnectAddress ? $t('worldCup2026.create') : $t('connect') }}</span>
      </button>
      <span v-if="accountMismatch" class="text-red-e6 text-sm text-center block mt-2">
        {{ $t('web3.addressMismatch', { address: accStore.getAccountInfo?.ethAddr }) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.bg-gradient-primary {
  background: linear-gradient(135deg, #FE913F 0%, #E58339 100%);
}
</style>
