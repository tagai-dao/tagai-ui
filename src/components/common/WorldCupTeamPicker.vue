<script setup lang="ts">
import { computed } from 'vue'
import { useWorldCupTeam } from '@/composables/useWorldCupTeam'
import { getTeamFlagUrl } from '@/data/world-cup-2026/flags'
import type { WcTeam } from '@/data/world-cup-2026/teams'
import type { WcTeamWithFixture } from '@/data/world-cup-2026/helpers'

const props = defineProps<{
  visible: boolean
  title: string
  teams: (WcTeam | WcTeamWithFixture)[]
  selectedCode?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [code: string, disabled?: boolean]
}>()

const { getTeamName } = useWorldCupTeam()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const isWithFixture = (team: WcTeam | WcTeamWithFixture): team is WcTeamWithFixture =>
  'kickoffUtc' in team

const formatKickoff = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
    width="92%"
    class="wc-team-picker-dialog"
    append-to-body
    destroy-on-close
  >
    <div class="wc-team-grid">
      <button
        v-for="team in teams"
        :key="team.code"
        type="button"
        class="wc-team-grid__item"
        :class="{
          'wc-team-grid__item--active': selectedCode === team.code,
          'wc-team-grid__item--disabled': isWithFixture(team) && team.kickoffStarted,
        }"
        :disabled="isWithFixture(team) && team.kickoffStarted"
        @click="onSelect(team)"
      >
        <img
          :src="getTeamFlagUrl(team.code, 40)"
          :alt="getTeamName(team.code)"
          class="wc-team-grid__flag"
          loading="lazy"
        />
        <span class="wc-team-grid__name">{{ getTeamName(team.code) }}</span>
        <span v-if="isWithFixture(team) && team.kickoffUtc" class="wc-team-grid__kickoff">
          {{ formatKickoff(team.kickoffUtc) }}
        </span>
        <span v-else class="wc-team-grid__group">{{ $t('worldCup2026.groupLabel', { group: team.group }) }}</span>
      </button>
    </div>
  </el-dialog>
</template>

<style scoped>
.wc-team-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding: 4px 2px 8px;
}

.wc-team-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.wc-team-grid__item:hover:not(.wc-team-grid__item--disabled) {
  border-color: #fe913f;
  box-shadow: 0 2px 8px rgba(254, 145, 63, 0.15);
}

.wc-team-grid__item--active {
  border-color: #fe913f;
  background: #fff7f0;
}

.wc-team-grid__item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: #f9fafb;
}

.wc-team-grid__item--disabled .wc-team-grid__flag {
  filter: grayscale(0.6);
}

.wc-team-grid__item--disabled .wc-team-grid__name {
  color: #9ca3af;
}

.wc-team-grid__flag {
  width: 40px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.wc-team-grid__name {
  font-size: 12px;
  font-weight: 600;
  color: #111;
  text-align: center;
  line-height: 1.25;
  word-break: break-word;
}

.wc-team-grid__group {
  font-size: 10px;
  color: #9ca3af;
}

.wc-team-grid__kickoff {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.wc-team-grid__item--disabled .wc-team-grid__kickoff {
  color: #d1d5db;
}

:deep(.wc-team-picker-dialog .el-dialog__body) {
  padding-top: 8px;
}
</style>
