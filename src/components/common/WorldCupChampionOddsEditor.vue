<script setup lang="ts">
import { useWorldCupTeam } from '@/composables/useWorldCupTeam'
import { WC_TOP_TEAM_CODES } from '@/data/world-cup-2026/top-teams'
import { OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'

const props = defineProps<{
  /** 前 N-1 队可编辑百分比（v-model.number 直接写回数组元素） */
  percents: number[]
  /** 最后一队百分比（只读） */
  lastPercent: number
}>()

const emit = defineEmits<{
  (e: 'equal'): void
  (e: 'favorites'): void
  (e: 'clear'): void
}>()

const { getTeamName, getTeamFlagUrl } = useWorldCupTeam()

const TOTAL = WC_TOP_TEAM_CODES.length
const LAST_INDEX = TOTAL - 1

/** 第 i 队展示百分比（前 N-1 来自 props.percents，最后来自 lastPercent，展示时 clamp 非负） */
const percentAt = (i: number) =>
  i === LAST_INDEX ? Math.max(0, props.lastPercent) : (props.percents[i] ?? 0)

const segmentColor = (i: number) => OUTCOME_CHART_COLORS[i % OUTCOME_CHART_COLORS.length]
</script>

<template>
  <div class="wc-champion-odds">
    <div class="flex items-center justify-between mb-2">
      <label class="wc-field__label mb-0 flex items-center gap-1">
        {{ $t('worldCup2026.initialRatio') }}
        <span class="text-red-500">*</span>
        <el-tooltip effect="dark" :content="$t('worldCup2026.championRatioTip')" placement="top">
          <button type="button" class="wc-ratio-tip">?</button>
        </el-tooltip>
      </label>
      <div class="flex gap-2">
        <button type="button" class="wc-odds-preset" @click="emit('clear')">
          {{ $t('worldCup2026.oddsClear') }}
        </button>
        <button type="button" class="wc-odds-preset" @click="emit('equal')">
          {{ $t('worldCup2026.oddsEqual') }}
        </button>
        <button type="button" class="wc-odds-preset" @click="emit('favorites')">
          {{ $t('worldCup2026.oddsFavorites') }}
        </button>
      </div>
    </div>

    <!-- 32 段概率汇总条 -->
    <div class="wc-odds-bar">
      <div
        v-for="i in TOTAL"
        :key="i - 1"
        class="wc-odds-bar__seg"
        :style="{ width: `${percentAt(i - 1)}%`, background: segmentColor(i - 1) }"
      />
    </div>

    <!-- 32 队可滚动编辑区 -->
    <div class="wc-odds-list">
      <div v-for="(code, i) in WC_TOP_TEAM_CODES" :key="code" class="wc-odds-row">
        <img :src="getTeamFlagUrl(code, 40)" :alt="getTeamName(code)" class="wc-odds-row__flag" />
        <span class="wc-odds-row__name">{{ getTeamName(code) }}</span>
        <input
          v-if="i !== LAST_INDEX"
          v-model.number="percents[i]"
          type="number"
          min="0"
          max="100"
          step="0.1"
          class="wc-odds-row__input"
        />
        <span v-else class="wc-odds-row__readonly">{{ Math.max(0, lastPercent).toFixed(1) }}</span>
        <span class="wc-odds-row__pct">%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wc-odds-bar {
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: #f3f4f6;
  margin-bottom: 10px;
}

.wc-odds-bar__seg {
  min-width: 1px;
  transition: width 0.2s;
}

.wc-field__label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-base);
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

.wc-odds-list {
  max-height: 340px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  padding: 4px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--surface);
}

.wc-odds-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--surface-2);
}

.wc-odds-row__flag {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.wc-odds-row__name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wc-odds-row__input {
  width: 56px;
  padding: 4px 6px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-base);
  background-color: var(--surface);
  text-align: right;
  outline: none;
}

.wc-odds-row__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.wc-odds-row__readonly {
  width: 56px;
  padding: 4px 6px;
  font-size: 12px;
  text-align: right;
  color: var(--text-muted);
}

.wc-odds-row__pct {
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.wc-odds-preset {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-base);
  background: var(--surface);
  color: var(--text-base);
  transition: border-color 0.15s, color 0.15s;
}

.wc-odds-preset:hover {
  border-color: #fe913f;
  color: #fe913f;
}

@media (max-width: 804px) {
  .wc-odds-list {
    grid-template-columns: 1fr;
  }
}
</style>
