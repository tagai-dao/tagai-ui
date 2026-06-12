import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { EventPredictData } from '@/types'
import { isMultiOutcomeMarket } from '@/composables/useEventMarketOutcomes'

/** 当前用户在该市场的投票 outcome（0-based），未投为 null */
export const usePredictVoteHighlight = (market: MaybeRefOrGetter<EventPredictData>) => {
  const userVotedOutcomeIndex = computed<number | null>(() => {
    const m = toValue(market)
    if (isMultiOutcomeMarket(m)) {
      const idx = m.voteOutcomeIndex
      return idx !== null && idx !== undefined ? idx : null
    }
    if (m.voteResult === 1) return 0
    if (m.voteResult === 2) return 1
    return null
  })

  const hasVoted = computed(() => userVotedOutcomeIndex.value !== null)

  const isVotedOutcome = (outcomeIndex: number) =>
    userVotedOutcomeIndex.value === outcomeIndex

  /** 投票成功后写回 market，按钮可立即高亮 */
  const applyLocalVote = (
    m: EventPredictData,
    outcomeIndex: number,
  ) => {
    if (isMultiOutcomeMarket(m)) {
      m.voteOutcomeIndex = outcomeIndex
      m.voteResult = outcomeIndex + 1
    } else {
      m.voteResult = outcomeIndex === 0 ? 1 : 2
    }
  }

  return { userVotedOutcomeIndex, hasVoted, isVotedOutcome, applyLocalVote }
}
