<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ text?: string | null; confidence?: number | string | null }>()
const { t } = useI18n()
const message = computed(() => typeof props.text === 'string' && props.text.trim() ? props.text : '')
const confidencePercent = computed(() => {
  const value = props.confidence
  if (value == null || !['number', 'string'].includes(typeof value) || typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null
})
</script>

<template>
  <section v-if="message" class="trade-note" role="note" :aria-label="t('tradeNote.title')">
    <div class="trade-note__header">
      <span>{{ t('tradeNote.title') }}</span>
      <span v-if="confidencePercent !== null" class="trade-note__confidence">
        {{ t('tradeNote.confidence') }} <strong>{{ confidencePercent }}%</strong>
      </span>
    </div>
    <p class="trade-note__message">{{ message }}</p>
  </section>
</template>

<style scoped>
.trade-note { min-width: 0; margin: 8px 0; padding: 10px 12px; border: 1px solid var(--border-base); border-radius: 10px; background: var(--surface-2); text-align: left; }
.trade-note__header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.trade-note__confidence { white-space: nowrap; }
.trade-note__confidence strong { color: var(--text-base); font-weight: 600; font-variant-numeric: tabular-nums; }
.trade-note__message { margin: 6px 0 0; color: var(--text-base); font-size: 13px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
