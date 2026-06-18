import { ref, computed, watch } from 'vue'
import { targetPercentsToDistributionHint, OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'

export const MIN_EVENT_OUTCOMES = 2
export const MAX_EVENT_OUTCOMES = 6

const DEFAULT_TRIPLE_BOUNDARY1 = 34
const DEFAULT_TRIPLE_BOUNDARY2 = 67

/** 将 100% 均分到 n 个 outcome（整数，总和为 100） */
export const splitEqualPercents = (count: number): number[] => {
  if (count <= 0) return []
  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

export type OutcomeRatioMode = 'binary' | 'triple' | 'multi'

export type OutcomeValidationResult = {
  valid: boolean
  outcomeErrors: string[]
  ratioError: string
}

export const useOutcomeRatioEditor = (initialCount = MIN_EVENT_OUTCOMES) => {
  const outcomeLabels = ref<string[]>(Array.from({ length: initialCount }, () => ''))

  const binaryRatio = ref(50)
  const tripleBoundary1 = ref(DEFAULT_TRIPLE_BOUNDARY1)
  const tripleBoundary2 = ref(DEFAULT_TRIPLE_BOUNDARY2)
  const multiPercents = ref<number[]>(splitEqualPercents(initialCount))

  const outcomeCount = computed(() => outcomeLabels.value.length)

  const ratioMode = computed<OutcomeRatioMode>(() => {
    const n = outcomeCount.value
    if (n === 2) return 'binary'
    if (n === 3) return 'triple'
    return 'multi'
  })

  const ratioPercents = computed(() => {
    if (ratioMode.value === 'binary') {
      const first = binaryRatio.value
      return [first, 100 - first]
    }
    if (ratioMode.value === 'triple') {
      const left = tripleBoundary1.value
      const draw = tripleBoundary2.value - tripleBoundary1.value
      const right = 100 - tripleBoundary2.value
      return [left, draw, right]
    }
    return [...multiPercents.value]
  })

  const distributionHint = computed(() => targetPercentsToDistributionHint(ratioPercents.value))

  const resetRatioForCount = (n: number) => {
    if (n === 2) {
      binaryRatio.value = 50
    } else if (n === 3) {
      tripleBoundary1.value = DEFAULT_TRIPLE_BOUNDARY1
      tripleBoundary2.value = DEFAULT_TRIPLE_BOUNDARY2
    } else {
      multiPercents.value = splitEqualPercents(n)
    }
  }

  watch(outcomeCount, (n, prev) => {
    if (n !== prev) resetRatioForCount(n)
  })

  const canAddOutcome = computed(() => outcomeCount.value < MAX_EVENT_OUTCOMES)
  const canRemoveOutcome = computed(() => outcomeCount.value > MIN_EVENT_OUTCOMES)

  const addOutcome = () => {
    if (!canAddOutcome.value) return
    outcomeLabels.value.push('')
  }

  const removeOutcome = (index: number) => {
    if (!canRemoveOutcome.value) return
    outcomeLabels.value.splice(index, 1)
  }

  const resetToDefaults = () => {
    outcomeLabels.value = ['', '']
    resetRatioForCount(MIN_EVENT_OUTCOMES)
  }

  const onTripleBoundary1Input = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value)
    tripleBoundary1.value = Math.min(Math.max(1, value), tripleBoundary2.value - 1)
  }

  const onTripleBoundary2Input = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value)
    tripleBoundary2.value = Math.max(Math.min(99, value), tripleBoundary1.value + 1)
  }

  /** 仅调整最后一项，使总和为 100% */
  const rebalanceLastMultiPercent = (percents: number[]) => {
    const lastIdx = percents.length - 1
    if (lastIdx < 1) return percents
    const sumExceptLast = percents.slice(0, lastIdx).reduce((a, b) => a + b, 0)
    percents[lastIdx] = Math.max(1, 100 - sumExceptLast)
    return percents
  }

  const setMultiPercent = (index: number, raw: number) => {
    const n = multiPercents.value.length
    if (n <= 1) {
      multiPercents.value = [100]
      return
    }

    const lastIdx = n - 1
    const next = [...multiPercents.value]

    // 最后一项仅用于自动平衡，忽略手动输入
    if (index === lastIdx) {
      multiPercents.value = rebalanceLastMultiPercent(next)
      return
    }

    const fixedSum = next
      .filter((_, i) => i !== index && i !== lastIdx)
      .reduce((a, b) => a + b, 0)
    const maxForIndex = 100 - fixedSum - 1
    next[index] = Math.max(1, Math.min(maxForIndex, Math.round(Number(raw) || 0)))
    multiPercents.value = rebalanceLastMultiPercent(next)
  }

  const equalSplit = () => resetRatioForCount(outcomeCount.value)

  const validateOutcomes = (t: (key: string) => string): OutcomeValidationResult => {
    if (ratioMode.value === 'multi') {
      multiPercents.value = rebalanceLastMultiPercent([...multiPercents.value])
    }
    const outcomeErrors = outcomeLabels.value.map(() => '')
    let valid = true

    const trimmed = outcomeLabels.value.map(l => l.trim())

    for (let i = 0; i < trimmed.length; i++) {
      if (!trimmed[i]) {
        outcomeErrors[i] = t('createPredict.outcomeLabelRequired')
        valid = false
      } else if (trimmed[i].length > 255) {
        outcomeErrors[i] = t('createPredict.outcomeLabelTooLong')
        valid = false
      }
    }

    const seen = new Set<string>()
    for (let i = 0; i < trimmed.length; i++) {
      const key = trimmed[i].toLowerCase()
      if (!key) continue
      if (seen.has(key)) {
        outcomeErrors[i] = t('createPredict.outcomeLabelDuplicate')
        valid = false
      }
      seen.add(key)
    }

    let ratioError = ''
    const sum = ratioPercents.value.reduce((a, b) => a + b, 0)
    if (sum !== 100 || ratioPercents.value.some(p => p <= 0)) {
      ratioError = t('createPredict.ratioSumInvalid')
      valid = false
    }

    return { valid, outcomeErrors, ratioError }
  }

  const getTrimmedLabels = () => outcomeLabels.value.map(l => l.trim())

  return {
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
    outcomeColors: OUTCOME_CHART_COLORS,
    isLastOutcomeIndex: (index: number) => index === multiPercents.value.length - 1,
  }
}
