<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { creationFeeAllocation, creationFeeExample, creatorPercentToBps } from '@/utils/v13/creation-fees'

const props = defineProps<{ feeBps: number; creatorBps: number; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:feeBps', value: number): void; (e: 'update:creatorBps', value: number): void }>()
const { t, locale } = useI18n()
const allocation = computed(() => creationFeeAllocation(props.creatorBps))
const maximum = 24
const creatorPercent = computed(() => Math.round(allocation.value.creator * 10) / 10)
const parts = computed(() => Object.entries(allocation.value).map(([key, value]) => ({ key, value })))
const example = computed(() => creationFeeExample(props.feeBps, props.creatorBps))
const validFee = computed(() => Number.isInteger(props.feeBps) && props.feeBps >= 100 && props.feeBps <= 300)
const number = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)
const money = (value: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 4 }).format(value)
</script>

<template>
  <div class="fee-settings">
    <div class="fee-heading">
      <div><h4>{{ t('v13Create.totalFee') }}</h4><p>{{ t('v13Create.totalFeeHelp') }}</p></div>
      <label class="fee-input"><input type="number" min="1" max="3" step="0.01" inputmode="decimal" :disabled="disabled" :value="feeBps / 100" :aria-label="t('v13Create.totalFee')" @input="emit('update:feeBps', Math.round(Number(($event.target as HTMLInputElement).value) * 100))" /><span>%</span></label>
    </div>
    <div class="allocation-heading"><span>{{ t('v13Create.allocationTitle') }}</span><strong>{{ t('v13Create.allocationCreator') }} {{ number(allocation.creator) }}%</strong></div>
    <div class="allocation-control" :class="{ disabled }">
      <div class="allocation-track" aria-hidden="true"><span v-for="part in parts" :key="part.key" :class="part.key" :style="{ width: `${part.value}%` }" /></div>
      <input class="creator-slider" type="range" min="0" :max="maximum" step="0.1" :disabled="disabled" :value="creatorPercent" :style="{ width: `calc(${maximum}% + 24px)` }" :aria-label="t('v13Create.dragCreator')" :aria-valuetext="t('v13Create.creatorSliderValue', { value: number(creatorPercent), max: number(maximum) })" aria-describedby="creator-slider-help" @input="emit('update:creatorBps', creatorPercentToBps(Number(($event.target as HTMLInputElement).value)))" />
    </div>
    <p id="creator-slider-help" class="drag-help">{{ t('v13Create.dragCreatorHelp', { max: number(maximum) }) }}</p>
    <ul class="allocation-legend">
      <li v-for="part in parts" :key="part.key"><span class="legend-dot" :class="part.key" /><span>{{ t(`v13Create.allocation${part.key[0].toUpperCase()}${part.key.slice(1)}`) }}<b>{{ number(part.value) }}%</b></span></li>
    </ul>
    <p v-if="validFee" class="fee-summary" aria-live="polite">{{ t('v13Create.compactFeeExample', { fee: money(example.fee), creator: money(example.creator) }) }}</p>
    <p v-else class="fee-warning" role="status">{{ t('v13Create.totalFeeRange') }}</p>
    <details class="allocation-details"><summary>{{ t('v13Create.feeDetails') }}</summary><p>{{ t('v13Create.allocationRules') }}</p><p>{{ t('v13Create.feeSettlement') }}</p></details>
  </div>
</template>

<style scoped>
.fee-settings { border-top:1px solid var(--border-base); padding-top:18px; margin-top:4px; min-width:0 }
.fee-heading { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:20px }
h4 { margin:0 0 4px; font-size:12px; font-weight:700; color:var(--text-base) }
p { margin:0; color:var(--text-muted); font-size:10px; line-height:1.65 }
.fee-input { display:flex; align-items:center; flex-shrink:0; width:104px; border:1px solid var(--border-base); border-radius:12px; background:color-mix(in srgb,var(--surface-2) 58%,transparent) }
.fee-input:focus-within { border-color:#e77a27; box-shadow:0 0 0 3px rgba(254,145,63,.08) }
.fee-input input { width:100%; min-width:0; min-height:44px; padding:0 10px; outline:none; border:0; border-radius:12px; background:transparent; color:var(--text-base); font-size:14px; font-weight:650 }
.fee-input>span { padding-right:12px; font-size:12px; color:var(--text-muted) }
.allocation-heading { display:flex; justify-content:space-between; gap:12px; color:var(--text-muted); font-size:11px }
.allocation-heading strong { color:#e77a27; font-weight:650 }
.allocation-control { position:relative; height:44px }
.allocation-track { position:absolute; inset:16px 0; display:flex; overflow:hidden; border-radius:6px }
.allocation-track>span { flex-shrink:0 }
.platform { background:#7c83d6 }.creator { background:#f29248 }.holders { background:#48bba1 }.frontend { background:#5aa8dc }.launcher { background:#b68bc9 }
.creator-slider { position:absolute; top:0; left:calc(10% - 12px); height:44px; padding:0; margin:0; appearance:none; -webkit-appearance:none; background:transparent; border:0; outline:none; cursor:ew-resize; touch-action:pan-y }
.creator-slider::-webkit-slider-runnable-track { height:12px; background:transparent }
.creator-slider::-moz-range-track { height:12px; background:transparent }
.creator-slider::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:24px; height:24px; margin-top:-6px; border:3px solid #f29248; border-radius:50%; background:var(--surface); box-shadow:0 1px 6px #0004 }
.creator-slider::-moz-range-thumb { box-sizing:border-box; width:24px; height:24px; border:3px solid #f29248; border-radius:50%; background:var(--surface); box-shadow:0 1px 6px #0004 }
.creator-slider:focus-visible::-webkit-slider-thumb { outline:3px solid var(--text-base); outline-offset:3px }
.creator-slider:focus-visible::-moz-range-thumb { outline:3px solid var(--text-base); outline-offset:3px }
.disabled { opacity:.5 }.creator-slider:disabled { cursor:not-allowed }
.drag-help { margin-top:-2px }
.allocation-legend { list-style:none; padding:0; margin:14px 0; display:flex; flex-wrap:wrap; gap:12px 20px }
.allocation-legend li { display:flex; align-items:flex-start; gap:6px; font-size:10px; color:var(--text-muted) }
.legend-dot { width:7px; height:7px; flex-shrink:0; border-radius:2px; margin-top:4px }
.allocation-legend b { display:block; margin-top:3px; color:var(--text-base); font-weight:600; font-variant-numeric:tabular-nums }
.fee-summary { color:var(--text-base); font-size:11px }.fee-warning { color:#e77a27 }
.allocation-details { margin-top:10px }.allocation-details summary { color:var(--text-muted); cursor:pointer; font-size:10px }.allocation-details p { margin-top:8px }
@media(max-width:480px) { .fee-heading { gap:12px }.fee-input { width:88px }.allocation-legend { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 8px } }
</style>
