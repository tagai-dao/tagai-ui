<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useWorldCupTeam } from '@/composables/useWorldCupTeam'
import { getTeamFlagUrl } from '@/data/world-cup-2026/flags'
import { getTeamByCode, type WcTeam } from '@/data/world-cup-2026/teams'
import { formatKickoffUtcToLocal, type WcTeamWithFixture } from '@/data/world-cup-2026/helpers'

const WC_CARD_W = 132
const WC_GRID_GAP = 6
const WC_GROUP_LABEL_W = 36
const WC_GROUP_ROW_GAP = 8
const WC_DIALOG_PAD = 80

const props = defineProps<{
  visible: boolean
  title: string
  teams: (WcTeam | WcTeamWithFixture)[]
  selectedCode?: string
  /** 左侧选国家：按组别分行展示；右侧选对手：同尺寸卡片平铺 */
  grouped?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [code: string, disabled?: boolean]
}>()

const { getTeamName } = useWorldCupTeam()
const { width: windowWidth } = useWindowSize()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const flatCols = computed(() => {
  const count = Math.max(props.teams.length, 1)
  return windowWidth.value <= 803 ? Math.min(2, count) : count
})

/** 按卡片列数计算弹窗宽度 */
const dialogWidth = computed(() => {
  const cols = props.grouped
    ? (windowWidth.value <= 803 ? 2 : 4)
    : flatCols.value
  const teamsW = cols * WC_CARD_W + (cols - 1) * WC_GRID_GAP
  const contentW = props.grouped
    ? WC_GROUP_LABEL_W + WC_GROUP_ROW_GAP + teamsW + WC_DIALOG_PAD
    : teamsW + WC_DIALOG_PAD
  return `${Math.min(contentW, windowWidth.value - 24)}px`
})

const groupedListRef = ref<HTMLElement | null>(null)

const allGroups = computed(() =>
  [...new Set(props.teams.map(t => t.group))].sort()
)

const teamsByGroup = computed(() =>
  allGroups.value.map(group => ({
    group,
    teams: props.teams.filter(t => t.group === group),
  }))
)

// 打开弹窗时滚动到已选球队所在组别行
watch(() => props.visible, async (open) => {
  if (!open || !props.grouped) return
  await nextTick()
  const team = props.selectedCode ? getTeamByCode(props.selectedCode) : undefined
  const group = team?.group ?? 'A'
  groupedListRef.value
    ?.querySelector(`[data-group="${group}"]`)
    ?.scrollIntoView({ block: 'nearest' })
})

const isWithFixture = (team: WcTeam | WcTeamWithFixture): team is WcTeamWithFixture =>
  'kickoffUtc' in team

const onSelect = (team: WcTeam | WcTeamWithFixture) => {
  const disabled = isWithFixture(team) && team.kickoffStarted
  emit('select', team.code, disabled)
  if (!disabled) emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    :width="dialogWidth"
    :style="{ '--wc-picker-dialog-w': dialogWidth }"
    align-center
    class="wc-team-picker-dialog wc-team-picker-dialog--fit"
    :class="{
      'wc-team-picker-dialog--grouped': grouped,
      'wc-team-picker-dialog--flat': !grouped,
    }"
    append-to-body
    destroy-on-close
  >
    <!-- grouped：单列表，每行左侧组别 + 右侧国家卡片 -->
    <div v-if="grouped" ref="groupedListRef" class="wc-grouped-list">
      <div
        v-for="{ group, teams: groupTeams } in teamsByGroup"
        :key="group"
        class="wc-group-row"
        :data-group="group"
      >
        <div class="wc-group-row__label">
          {{ $t('worldCup2026.groupLabel', { group }) }}
        </div>
        <div class="wc-group-row__teams">
          <button
            v-for="team in groupTeams"
            :key="team.code"
            type="button"
            class="wc-team-card"
            :class="{ 'wc-team-card--active': selectedCode === team.code }"
            @click="onSelect(team)"
          >
            <img
              :src="getTeamFlagUrl(team.code, 40)"
              :alt="getTeamName(team.code)"
              class="wc-team-card__flag"
              loading="lazy"
            />
            <span class="wc-team-card__name">{{ getTeamName(team.code) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- flat：右边选对手，卡片尺寸与左侧一致 -->
    <div
      v-else
      class="wc-flat-list"
      :style="{ '--wc-flat-cols': flatCols }"
    >
      <button
        v-for="team in teams"
        :key="team.code"
        type="button"
        class="wc-team-card"
        :class="{
          'wc-team-card--active': selectedCode === team.code,
          'wc-team-card--disabled': isWithFixture(team) && team.kickoffStarted,
          'wc-team-card--with-meta': isWithFixture(team) && !!team.kickoffUtc,
        }"
        :disabled="isWithFixture(team) && team.kickoffStarted"
        @click="onSelect(team)"
      >
        <img
          :src="getTeamFlagUrl(team.code, 40)"
          :alt="getTeamName(team.code)"
          class="wc-team-card__flag"
          loading="lazy"
        />
        <span class="wc-team-card__name">{{ getTeamName(team.code) }}</span>
        <span v-if="isWithFixture(team) && team.kickoffUtc" class="wc-team-card__kickoff">
          {{ formatKickoffUtcToLocal(team.kickoffUtc) }}
        </span>
      </button>
    </div>
  </el-dialog>
</template>

<style scoped>
.wc-grouped-list,
.wc-flat-list {
  --wc-card-w: 132px;
  --wc-card-h: 88px;
}

.wc-grouped-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: 2px 0 8px;
}

.wc-flat-list {
  display: grid;
  grid-template-columns: repeat(var(--wc-flat-cols), var(--wc-card-w));
  gap: 6px;
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 2px 0 8px;
}

.wc-group-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: max-content;
  max-width: 100%;
}

.wc-group-row__label {
  flex: 0 0 36px;
  padding-top: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  line-height: 1.2;
}

.wc-group-row__teams {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, var(--wc-card-w));
  gap: 6px;
}

@media (max-width: 803px) {
  .wc-group-row__teams {
    grid-template-columns: repeat(2, var(--wc-card-w));
  }
}

.wc-team-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: var(--wc-card-w);
  min-height: var(--wc-card-h);
  padding: 8px 4px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.wc-team-card--with-meta {
  min-height: calc(var(--wc-card-h) + 12px);
}

.wc-team-card:hover:not(.wc-team-card--disabled) {
  border-color: #fe913f;
  box-shadow: 0 2px 6px rgba(254, 145, 63, 0.12);
}

.wc-team-card--active {
  border-color: #fe913f;
  background: #fff7f0;
}

.wc-team-card--disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: #f9fafb;
}

.wc-team-card--disabled .wc-team-card__flag {
  filter: grayscale(0.6);
}

.wc-team-card--disabled .wc-team-card__name,
.wc-team-card--disabled .wc-team-card__kickoff {
  color: #9ca3af;
}

.wc-team-card__flag {
  width: 40px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.wc-team-card__name {
  font-size: 12px;
  font-weight: 600;
  color: #111;
  text-align: center;
  line-height: 1.15;
  word-break: break-word;
  max-width: 100%;
}

.wc-team-card__kickoff {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
  text-align: center;
  line-height: 1.15;
}

:deep(.wc-team-picker-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.wc-team-picker-dialog--fit .el-dialog__body) {
  display: flex;
  justify-content: center;
  padding-left: 28px;
  padding-right: 28px;
  padding-bottom: 24px;
}

:deep(.wc-team-picker-dialog--grouped .el-dialog__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>

<!-- teleport 到 body，需非 scoped 才能可靠覆盖全局 el-dialog 样式 -->
<style>
.el-dialog.wc-team-picker-dialog--fit {
  max-width: calc(100vw - 24px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.el-dialog.wc-team-picker-dialog--grouped {
  display: flex;
  flex-direction: column;
  height: 80vh !important;
  max-height: 80vh !important;
}

.el-dialog.wc-team-picker-dialog--grouped .el-dialog__body {
  flex: 1;
  min-height: 0;
}

.el-dialog.wc-team-picker-dialog--flat {
  height: auto !important;
  max-height: 80vh !important;
}

@media (max-width: 803px) {
  .el-overlay .el-dialog.wc-team-picker-dialog--fit {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    margin: 0 !important;
    width: var(--wc-picker-dialog-w) !important;
    max-width: calc(100vw - 24px) !important;
    border-radius: 24px !important;
  }

  .el-overlay .el-dialog.wc-team-picker-dialog--grouped {
    height: 80vh !important;
    max-height: 80vh !important;
  }
}
</style>
