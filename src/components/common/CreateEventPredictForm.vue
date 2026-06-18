<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseUnits } from 'viem'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { useCommunityStore } from '@/stores/community'
import { handleErrorTip, notify } from '@/utils/notify'
import { GlobalModalType } from '@/types'
import { createFPMMMarketForEvent, preCreateFPMMMarketEvent } from '@/apis/api'
import { OperateType, useTweet } from '@/composables/useTweet'
import { useAccount } from '@/composables/useAccount'
import { useOutcomeRatioEditor } from '@/composables/useOutcomeRatioEditor'
import emitter from '@/utils/emitter'
import { getTokenBalance } from '@/utils/web3'
import { formatAmount } from '@/utils/helper'
import { approveToken, createEventMarket, type EventMarketDexConfig } from '@/utils/fpmm'
import { FPMMDeterministicFactoryEventV3 } from '@/config'

const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const { preCheckCuration } = useTweet()
const accStore = useAccountStore()
const modalStore = useModalStore()
const comStore = useCommunityStore()
const { accountMismatch } = useAccount()

const userBalance = ref(0)
const createLoading = ref(false)
const timeRemaining = ref('')

const form = reactive({
  title: '',
  body: '',
  announceDate: '',
  initAmount: '',
})

const errors = reactive({
  title: '',
  body: '',
  announceDate: '',
  initAmount: '',
  ratio: '',
})

const outcomeErrors = ref<string[]>(['', ''])

const {
  outcomeLabels,
  outcomeCount,
  ratioMode,
  ratioPercents,
  distributionHint,
  binaryRatio,
  tripleBoundary1,
  tripleBoundary2,
  multiPercents,
  canAddOutcome,
  canRemoveOutcome,
  addOutcome,
  removeOutcome,
  resetToDefaults,
  onTripleBoundary1Input,
  onTripleBoundary2Input,
  setMultiPercent,
  equalSplit,
  validateOutcomes,
  getTrimmedLabels,
  outcomeColors,
  isLastOutcomeIndex,
} = useOutcomeRatioEditor()

const outcomePlaceholders = computed(() => [
  t('predictTrade.yes'),
  t('predictTrade.no'),
])

const ratioSummaryText = computed(() =>
  ratioPercents.value
    .map((p, i) => {
      const label = outcomeLabels.value[i]?.trim() || `#${i + 1}`
      return `${label} ${p}%`
    })
    .join(' / '),
)

const tripleBarStyle = computed(() => ({
  left: { width: `${ratioPercents.value[0]}%`, background: outcomeColors[0] },
  draw: { width: `${ratioPercents.value[1]}%`, background: outcomeColors[1] },
  right: { width: `${ratioPercents.value[2]}%`, background: outcomeColors[2] },
}))

const updateTimeRemaining = () => {
  if (!form.announceDate) {
    timeRemaining.value = ''
    return
  }
  const diff = new Date(form.announceDate).getTime() - Date.now()
  if (diff <= 0) {
    timeRemaining.value = t('createPredict.timeExpired')
    return
  }
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`, `${seconds}s`)
  timeRemaining.value = parts.join(' ')
}

watch(() => form.announceDate, updateTimeRemaining)

let timer: ReturnType<typeof setInterval> | null = null

const validateForm = (): boolean => {
  errors.title = ''
  errors.body = ''
  errors.announceDate = ''
  errors.initAmount = ''
  errors.ratio = ''

  let valid = true

  if (!form.title.trim()) {
    errors.title = t('createPredict.titleRequired')
    valid = false
  } else if (form.title.trim().length < 3) {
    errors.title = t('createPredict.titleTooShort')
    valid = false
  } else if (form.title.trim().length > 100) {
    errors.title = t('createPredict.titleTooLong')
    valid = false
  }

  if (!form.body.trim()) {
    errors.body = t('createPredict.bodyRequired')
    valid = false
  } else if (form.body.trim().length > 300) {
    errors.body = t('createPredict.bodyTooLong')
    valid = false
  }

  if (!form.announceDate) {
    errors.announceDate = t('createPredict.announceDateRequired')
    valid = false
  } else if (new Date(form.announceDate).getTime() <= Date.now()) {
    errors.announceDate = t('createPredict.announceDateFuture')
    valid = false
  }

  if (!form.initAmount) {
    errors.initAmount = t('createPredict.amountRequired')
    valid = false
  } else if (isNaN(Number(form.initAmount)) || Number(form.initAmount) <= 0) {
    errors.initAmount = t('createPredict.amountRequired')
    valid = false
  }

  const outcomeResult = validateOutcomes(t)
  outcomeErrors.value = outcomeResult.outcomeErrors
  if (!outcomeResult.valid) valid = false
  if (outcomeResult.ratioError) {
    errors.ratio = outcomeResult.ratioError
    valid = false
  }

  return valid
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

    const outcomes = getTrimmedLabels()
    const hint = [...distributionHint.value]

    modalStore.setModalCloseEnable(false)
    await approveToken(FPMMDeterministicFactoryEventV3, token, parseUnits(form.initAmount.toString(), 18))

    const preMarketData = await preCreateFPMMMarketEvent({
      twitterId: accInfo.twitterId,
      tick,
      title: form.title.trim(),
      text: form.body.trim(),
      outcomes,
      distributionHint: hint,
    })

    let { questionId, needOP, feePath, outcomeCount: apiOutcomeCount, distributionHint: hintFromApi, feeDexVersion, feeQuoteTarget, feePoolId } = preMarketData
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

    const endTime = Math.floor(new Date(form.announceDate).getTime() / 1000)
    const onChainHint = hintFromApi?.length ? hintFromApi : hint
    const { hash } = await createEventMarket(
      questionId,
      token,
      onChainHint,
      apiOutcomeCount ?? outcomes.length,
      endTime,
      parseUnits(form.initAmount.toString(), 18),
      dexConfig,
    )

    await createFPMMMarketForEvent(accInfo.twitterId, questionId, hash)
    modalStore.setModalCloseEnable(true)
    emitter.emit('createPredictSuccess')
    emit('created')
  } catch (error) {
    handleErrorTip(error)
  } finally {
    modalStore.setModalCloseEnable(true)
    createLoading.value = false
  }
}

const resetForm = () => {
  form.title = ''
  form.body = ''
  form.announceDate = ''
  form.initAmount = ''
  errors.title = ''
  errors.body = ''
  errors.announceDate = ''
  errors.initAmount = ''
  errors.ratio = ''
  resetToDefaults()
  outcomeErrors.value = ['', '']
  timeRemaining.value = ''
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
  timer = setInterval(() => {
    if (form.announceDate) updateTimeRemaining()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="event-predict-form space-y-4">
    <!-- 标题 -->
    <div>
      <label class="block text-sm font-medium text-black mb-2">
        {{ $t('createPredict.titleLabel') }}
        <span class="text-red-500">*</span>
      </label>
      <input
        v-model="form.title"
        type="text"
        :placeholder="$t('createPredict.titlePlaceholderEvent')"
        class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        :class="{ 'border-red-500': errors.title, 'border-grey-light': !errors.title }"
        maxlength="100"
      />
      <div v-if="errors.title" class="text-red-500 text-sm mt-1">{{ errors.title }}</div>
      <div class="text-grey-normal text-xs mt-1">
        {{ form.title.length }}/100 {{ $t('createPredict.characters') }}
      </div>
    </div>

    <!-- 预测内容 -->
    <div>
      <label class="block text-sm font-medium text-black mb-2">
        {{ $t('createPredict.bodyLabel') }}
        <span class="text-red-500">*</span>
      </label>
      <textarea
        v-model="form.body"
        :placeholder="$t('createPredict.bodyPlaceholder')"
        rows="4"
        maxlength="300"
        class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        :class="{ 'border-red-500': errors.body, 'border-grey-light': !errors.body }"
      />
      <div v-if="errors.body" class="text-red-500 text-sm mt-1">{{ errors.body }}</div>
      <div class="text-grey-normal text-xs mt-1">
        {{ form.body.length }}/300 {{ $t('createPredict.characters') }}
      </div>
    </div>

    <!-- Outcome 列表 -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-black">
          {{ $t('createPredict.outcomesSectionTitle') }}
          <span class="text-red-500">*</span>
        </label>
        <span class="text-xs text-grey-normal">{{ outcomeCount }}/6</span>
      </div>
      <p class="text-xs text-grey-normal mb-3">{{ $t('createPredict.outcomesSectionHint') }}</p>

      <div class="space-y-2">
        <div
          v-for="(_, index) in outcomeLabels"
          :key="index"
          class="flex items-center gap-2"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: outcomeColors[index] }"
          />
          <input
            v-model="outcomeLabels[index]"
            type="text"
            :placeholder="$t('createPredict.outcomeLabelPlaceholder', { index: index + 1, example: outcomePlaceholders[index] ?? '' })"
            class="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="{ 'border-red-500': outcomeErrors[index], 'border-grey-light': !outcomeErrors[index] }"
            maxlength="255"
          />
          <button
            v-if="canRemoveOutcome"
            type="button"
            class="shrink-0 w-9 h-9 rounded-lg border border-grey-light text-grey-normal hover:text-red-500 hover:border-red-200 transition-colors"
            :aria-label="$t('createPredict.removeOutcome')"
            @click="removeOutcome(index)"
          >
            <i-ep-minus class="mx-auto" />
          </button>
        </div>
      </div>
      <div v-for="(err, index) in outcomeErrors" :key="`err-${index}`">
        <p v-if="err" class="text-red-500 text-xs mt-1">{{ err }}</p>
      </div>
      <button
        v-if="canAddOutcome"
        type="button"
        class="mt-3 text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
        @click="addOutcome"
      >
        <i-ep-plus />
        {{ $t('createPredict.addOutcome') }}
      </button>
    </div>

    <!-- 公布日期 -->
    <div>
      <label class="flex items-center gap-1 text-sm font-medium text-black mb-2">
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
      <div v-else-if="timeRemaining" class="text-blue-500 text-sm mt-1 flex items-center gap-1">
        <span class="font-medium">{{ $t('createPredict.timeLeft') }}:</span>
        <span>{{ timeRemaining }}</span>
      </div>
    </div>

    <!-- 初始概率 -->
    <div>
      <div class="flex justify-between items-center mb-2 gap-2">
        <label class="flex items-center gap-1 text-sm font-medium text-black shrink-0">
          {{ $t('createPredict.initialRatio') }}
          <span class="text-red-500">*</span>
          <el-tooltip
            effect="dark"
            :content="ratioMode === 'binary'
              ? $t('createPredict.initialRatioTipEvent')
              : ratioMode === 'triple'
                ? $t('createPredict.initialRatioTipTriple')
                : $t('createPredict.initialRatioTipMulti')"
            placement="top"
          >
            <button type="button" class="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs">?</button>
          </el-tooltip>
        </label>
        <button
          type="button"
          class="text-xs text-blue-500 hover:text-blue-600 shrink-0"
          @click="equalSplit"
        >
          {{ $t('createPredict.equalSplit') }}
        </button>
      </div>

      <!-- 二元滑杆 -->
      <template v-if="ratioMode === 'binary'">
        <div class="flex justify-end mb-2 text-sm font-medium">
          <span :style="{ color: outcomeColors[0] }">{{ ratioPercents[0] }}%</span>
          <span class="mx-1 text-grey-normal">/</span>
          <span :style="{ color: outcomeColors[1] }">{{ ratioPercents[1] }}%</span>
        </div>
        <div class="relative h-6 flex items-center">
          <input
            v-model.number="binaryRatio"
            type="range"
            min="1"
            max="99"
            class="w-full h-2 rounded-lg appearance-none cursor-pointer ep-slider-thumb"
            :style="{
              background: `linear-gradient(to right, ${outcomeColors[0]} ${binaryRatio}%, ${outcomeColors[1]} ${binaryRatio}%)`,
            }"
          />
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2 text-xs text-grey-normal">
          <span class="truncate">{{ outcomeLabels[0]?.trim() || outcomePlaceholders[0] }}</span>
          <span class="truncate text-right">{{ outcomeLabels[1]?.trim() || outcomePlaceholders[1] }}</span>
        </div>
      </template>

      <!-- 三元双滑杆 -->
      <template v-else-if="ratioMode === 'triple'">
        <div class="flex justify-end mb-2 text-sm font-medium gap-1 flex-wrap">
          <span
            v-for="(p, i) in ratioPercents"
            :key="i"
            :style="{ color: outcomeColors[i] }"
          >
            <template v-if="i > 0"> / </template>{{ p }}%
          </span>
        </div>
        <div class="ep-ratio-track">
          <div class="ep-ratio-bar" aria-hidden="true">
            <div class="ep-ratio-bar__seg" :style="tripleBarStyle.left" />
            <div class="ep-ratio-bar__seg" :style="tripleBarStyle.draw" />
            <div class="ep-ratio-bar__seg" :style="tripleBarStyle.right" />
          </div>
          <div class="ep-ratio-slider">
            <input
              type="range"
              class="ep-ratio-slider__input ep-ratio-slider__input--first"
              min="0"
              max="100"
              :value="tripleBoundary1"
              @input="onTripleBoundary1Input"
            />
            <input
              type="range"
              class="ep-ratio-slider__input ep-ratio-slider__input--second"
              min="0"
              max="100"
              :value="tripleBoundary2"
              @input="onTripleBoundary2Input"
            />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2 text-xs text-grey-normal">
          <span v-for="(label, i) in outcomeLabels" :key="i" class="truncate text-center">
            {{ label.trim() || `#${i + 1}` }}
          </span>
        </div>
      </template>

      <!-- 4+ 数字输入 -->
      <template v-else>
        <div class="space-y-2">
          <div
            v-for="(_, index) in multiPercents"
            :key="index"
            class="flex items-center gap-2"
          >
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: outcomeColors[index] }"
            />
            <span class="text-sm text-grey-normal flex-1 truncate">
              {{ outcomeLabels[index]?.trim() || `#${index + 1}` }}
            </span>
            <div class="flex items-center gap-1">
              <input
                :value="multiPercents[index]"
                type="number"
                min="1"
                max="99"
                class="w-16 px-2 py-1.5 border rounded-lg text-sm text-right"
                :class="isLastOutcomeIndex(index)
                  ? 'border-grey-light bg-gray-50 text-grey-normal cursor-not-allowed'
                  : 'border-grey-light'"
                :readonly="isLastOutcomeIndex(index)"
                :title="isLastOutcomeIndex(index) ? $t('createPredict.lastOutcomeAutoBalance') : undefined"
                @change="!isLastOutcomeIndex(index) && setMultiPercent(index, Number(($event.target as HTMLInputElement).value))"
              />
              <span class="text-sm text-grey-normal">%</span>
            </div>
          </div>
        </div>
        <p class="text-xs text-grey-normal mt-2 text-right">
          {{ $t('createPredict.ratioTotal') }}: {{ ratioPercents.reduce((a, b) => a + b, 0) }}%
        </p>
      </template>

      <p v-if="errors.ratio" class="text-red-500 text-sm mt-1">{{ errors.ratio }}</p>
      <p v-else class="text-xs text-grey-normal mt-2">{{ ratioSummaryText }}</p>
    </div>

    <!-- 注入资金 -->
    <div>
      <label class="flex items-center gap-1 text-sm font-medium text-black mb-2">
        {{ $t('createPredict.initAmount') }}
        <span class="text-red-500">*</span>
        <el-tooltip effect="dark" :content="$t('createPredict.initAmountTip')" placement="top">
          <button type="button" class="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs">?</button>
        </el-tooltip>
      </label>
      <div class="relative">
        <input
          v-model="form.initAmount"
          type="number"
          step="0.0001"
          min="0"
          :placeholder="$t('createPredict.amountPlaceholder')"
          class="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
          :class="{ 'border-red-500': errors.initAmount, 'border-grey-light': !errors.initAmount }"
        />
        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-grey-normal text-sm font-medium">
          {{ comStore.currentSelectedCommunity?.tick }}
        </span>
      </div>
      <div class="flex justify-between items-start mt-1">
        <div class="text-red-500 text-sm">{{ errors.initAmount }}</div>
        <div class="text-grey-normal text-xs text-right ml-auto">
          {{ $t('balance') }}: {{ formatAmount(userBalance) }} {{ comStore.currentSelectedCommunity?.tick }}
        </div>
      </div>
    </div>

    <div class="mt-8">
      <button
        type="button"
        class="w-full h-12 bg-gradient-primary text-white font-bold rounded-full text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="createLoading || accountMismatch"
        @click="handleCreate"
      >
        <i-ep-loading v-if="createLoading" class="animate-spin" />
        <span>{{ accStore.ethConnectAddress ? $t('createPredict.createEvent') : $t('connect') }}</span>
      </button>
      <span v-if="accountMismatch" class="text-red-e6 text-sm text-center block mt-2">
        {{ $t('web3.addressMismatch', { address: accStore.getAccountInfo?.ethAddr }) }}
      </span>
      <span v-if="createLoading" class="text-red-e6 text-sm text-center block mt-2">
        {{ $t('createPredict.creatingTip') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.ep-slider-thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ep-slider-thumb::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e5e7eb;
  cursor: pointer;
}

.ep-ratio-track {
  position: relative;
  height: 20px;
  margin-bottom: 8px;
}

.ep-ratio-bar {
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

.ep-ratio-bar__seg {
  min-width: 4px;
  transition: width 0.2s;
}

.ep-ratio-slider {
  position: absolute;
  inset: 0;
}

.ep-ratio-slider__input {
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

.ep-ratio-slider__input--first { z-index: 2; }
.ep-ratio-slider__input--second { z-index: 3; }

.ep-ratio-slider__input::-webkit-slider-runnable-track,
.ep-ratio-slider__input::-moz-range-track {
  height: 10px;
  background: transparent;
  border: none;
}

.ep-ratio-slider__input::-webkit-slider-thumb,
.ep-ratio-slider__input::-moz-range-thumb {
  pointer-events: all;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: grab;
}

.ep-ratio-slider__input--first::-webkit-slider-thumb,
.ep-ratio-slider__input--first::-moz-range-thumb {
  border-color: #ef4444;
}

.ep-ratio-slider__input--second::-webkit-slider-thumb,
.ep-ratio-slider__input--second::-moz-range-thumb {
  border-color: #3b82f6;
}

:deep(.el-input__wrapper) {
  padding: 11px 16px;
  border-radius: 0.75rem;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset !important;
}
</style>
