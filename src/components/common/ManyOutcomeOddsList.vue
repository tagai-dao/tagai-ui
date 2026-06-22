<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EventPredictData } from '@/types'
import { useEventMarketOutcomes } from '@/composables/useEventMarketOutcomes'
import { getOutcomeFlagUrl } from '@/composables/useWorldCupMarkets'

const props = withDefaults(defineProps<{
  market: EventPredictData
  /** 默认可见行数（按概率降序） */
  defaultVisible?: number
  /** 按 outcomeIndex 覆盖展示概率（0~1）；无数据时回退池子边际概率 */
  priceByIndex?: Record<number, number | null | undefined>
  /** 是否可点击选择 outcome（交易面板） */
  selectable?: boolean
  selectedIndex?: number | null
  /** 是否按概率降序排列；交易面板保持 outcome 原始顺序便于查找 */
  sortByPercent?: boolean
}>(), {
  defaultVisible: 3,
  selectable: false,
  selectedIndex: null,
  sortByPercent: true,
})

const emit = defineEmits<{
  select: [outcomeIndex: number]
}>()

const expanded = ref(false)

const { outcomeList, getPercent, getOutcomeDisplayLabel } = useEventMarketOutcomes(() => props.market)

const resolvePercent = (outcomeIndex: number) => {
  const override = props.priceByIndex?.[outcomeIndex]
  if (override != null && Number.isFinite(override)) return Math.max(0, Math.min(1, override))
  return getPercent(outcomeIndex)
}

const rows = computed(() => {
  const mapped = outcomeList.value.map(outcome => ({
    outcome,
    percent: resolvePercent(outcome.outcomeIndex),
    flag: getOutcomeFlagUrl(outcome.label),
    label: getOutcomeDisplayLabel(outcome.outcomeIndex),
  }))
  return props.sortByPercent
    ? [...mapped].sort((a, b) => b.percent - a.percent)
    : mapped
})

const visibleRows = computed(() =>
  expanded.value ? rows.value : rows.value.slice(0, props.defaultVisible),
)

const hiddenCount = computed(() =>
  Math.max(0, rows.value.length - props.defaultVisible),
)

const formatPct = (p: number) => {
  if (p > 0 && p < 0.001) return '<0.1%'
  return `${(p * 100).toFixed(p >= 0.1 ? 1 : 2)}%`
}
</script>

<template>
  <div class="many-outcome-odds">
    <component
      :is="selectable ? 'button' : 'div'"
      v-for="row in visibleRows"
      :key="row.outcome.outcomeIndex"
      :type="selectable ? 'button' : undefined"
      class="many-outcome-odds__row"
      :class="{
        'many-outcome-odds__row--selectable': selectable,
        'many-outcome-odds__row--selected': selectable && selectedIndex === row.outcome.outcomeIndex,
      }"
      @click="selectable && emit('select', row.outcome.outcomeIndex)"
    >
      <span class="many-outcome-odds__main">
        <img
          v-if="row.flag"
          :src="row.flag"
          class="many-outcome-odds__flag"
          alt=""
          loading="lazy"
        />
        <span class="many-outcome-odds__label">{{ row.label }}</span>
      </span>
      <span class="many-outcome-odds__pct tabular-nums">{{ formatPct(row.percent) }}</span>
    </component>

    <button
      v-if="hiddenCount > 0"
      type="button"
      class="many-outcome-odds__more"
      @click="expanded = !expanded"
    >
      {{ expanded ? $t('showLess') : $t('more') }}
      <span v-if="!expanded" class="many-outcome-odds__more-count">(+{{ hiddenCount }})</span>
    </button>
  </div>
</template>

<style scoped>
.many-outcome-odds {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.many-outcome-odds__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-base, #e5e7eb);
  background: var(--surface, #fff);
  text-align: left;
}

.many-outcome-odds__row--selectable {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.many-outcome-odds__row--selectable:hover:not(:disabled) {
  border-color: #fe913f;
  background: #fff7ed;
}

.many-outcome-odds__row--selected {
  border-color: #fe913f;
  background: #fff7ed;
  box-shadow: 0 0 0 1px rgba(254, 145, 63, 0.25);
}

.many-outcome-odds__row:disabled {
  cursor: default;
}

.many-outcome-odds__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.many-outcome-odds__flag {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.many-outcome-odds__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-base, #111);
  line-height: 1.3;
  word-break: break-word;
}

.many-outcome-odds__pct {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-base, #111);
  flex-shrink: 0;
}

.many-outcome-odds__more {
  align-self: center;
  margin-top: 2px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #fe913f;
  border-radius: 999px;
  transition: background 0.15s;
}

.many-outcome-odds__more:hover {
  background: #fff7ed;
}

.many-outcome-odds__more-count {
  margin-left: 2px;
  opacity: 0.85;
}
</style>
