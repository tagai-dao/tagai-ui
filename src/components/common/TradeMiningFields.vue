<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CreationOptions } from '@/utils/v13/creation'
import type { V13IndexConfig } from '@/types'
import { stakingRewardRatios } from '@/utils/v14/creation-config'

const props = defineProps<{ modelValue: number; options?: CreationOptions; index: V13IndexConfig; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>()
const { t } = useI18n()
const enabled = computed(() => props.modelValue !== 0)
const input = ref(String(Number.isFinite(props.modelValue) && props.modelValue > 0 ? props.modelValue / 100 : 20))
const max = computed(() => Math.min(8000, props.options?.tradePool?.maxRewardRatio ?? 8000) / 100)
const available = computed(() => props.options?.tradePool?.enabled === true)
const valid = computed(() => Number.isInteger(props.modelValue) && props.modelValue > 0 && props.modelValue <= max.value * 100)
const ratios = computed(() => {
  const w = props.index.targetWeights
  if ((enabled.value && !valid.value) || w.some(n => !Number.isInteger(n) || n <= 0) || w.reduce((a, b) => a + b, 0) !== 10000) return []
  return stakingRewardRatios(w, enabled.value ? props.modelValue : 0)
})
function change() {
  const bps = /^\d+(\.\d{1,2})?$/.test(input.value) ? Math.round(Number(input.value) * 100) : NaN
  emit('update:modelValue', bps > 0 ? bps : NaN)
}
function toggle(event: Event) {
  if ((event.target as HTMLInputElement).checked) change()
  else emit('update:modelValue', 0)
}
const symbol = (i: number) => props.options?.assets.find(a => a.address.toLowerCase() === props.index.constituentAssets[i]?.toLowerCase())?.symbol ?? '—'
</script>

<template>
  <div class="trade-mining">
    <label class="toggle"><input type="checkbox" :checked="enabled" :disabled="disabled || (!available && !enabled)" @change="toggle" /><span>{{ t('v14Create.enableTradeMining') }}</span></label>
    <p>{{ t('v14Create.tradeHelp') }}</p>
    <p v-if="!available" class="warning">{{ t('v14Create.unavailable') }}</p>
    <template v-if="enabled">
      <label class="ratio-label" for="trade-mining-ratio">{{ t('v14Create.tradeRatio') }}<span class="ratio-input"><input id="trade-mining-ratio" v-model="input" type="number" min="0.01" :max="max" step="0.01" inputmode="decimal" :disabled="disabled" :aria-invalid="!valid" aria-describedby="trade-mining-limit" @input="change" /><span>%</span></span></label>
      <p id="trade-mining-limit" :class="{ warning: !valid }">{{ t('v14Create.ratioLimit', { max }) }}</p>
    </template>
    <div v-if="ratios.length" class="allocation">
      <strong>{{ t('v14Create.rewardAllocation') }}</strong>
      <div v-if="enabled"><span>{{ t('v14Create.tradePool') }}</span><b>{{ (modelValue / 100).toFixed(2) }}%</b></div>
      <div v-for="(ratio, i) in ratios" :key="i"><span>{{ symbol(i) }} LP</span><b>{{ (ratio / 100).toFixed(2) }}%</b></div>
      <p>{{ t('v14Create.allocationHelp') }}</p>
    </div>
  </div>
</template>

<style scoped>
.trade-mining { display:grid; gap:10px; padding:14px; border:1px solid var(--border-base); border-radius:12px; color:var(--text-base) }
.toggle { display:flex; gap:10px; align-items:center; font-size:12px; font-weight:650; cursor:pointer }
.toggle input { width:18px; height:18px; accent-color:#e77a27 }
p { margin:0; font-size:11px; line-height:1.65; color:var(--text-muted) }
.ratio-label { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; font-size:11px }
.ratio-input { display:flex; align-items:center; width:125px; border:1px solid var(--border-base); border-radius:10px; overflow:hidden }
.ratio-input:focus-within { border-color:#e77a27 }
.ratio-input input { width:100%; min-width:0; height:42px; padding:0 10px; outline:none; border:0; background:var(--surface-2); color:var(--text-base) }
.ratio-input>span { padding:0 10px }
.warning { color:#e77a27 }
.allocation { display:grid; gap:8px; padding-top:10px; border-top:1px solid var(--border-base); font-size:11px }
.allocation>div { display:flex; justify-content:space-between; gap:12px }
.allocation b { font-variant-numeric:tabular-nums }
</style>
