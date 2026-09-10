<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { V13IndexConfig } from '@/types'
import type { CreationOptions } from '@/utils/v13/creation'
import IndexFeeAllocation from './IndexFeeAllocation.vue'
import IndexAssetSelect from './IndexAssetSelect.vue'

const props = defineProps<{ modelValue: V13IndexConfig; options?: CreationOptions; error: string; loading: boolean; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: V13IndexConfig): void; (e: 'reload'): void }>()
const { t, locale } = useI18n()
const total = computed(() => props.modelValue.targetWeights.reduce((a, b) => a + b, 0) / 100)
const nextAsset = computed(() => props.options?.assets.find(a => !props.modelValue.constituentAssets.some(b => a.address.toLowerCase() === b.toLowerCase())))
const ready = computed(() => !props.loading && !props.error && !!props.options?.assets.length)
const amount = (n: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 5 }).format(n)
function patch(value: Partial<V13IndexConfig>) { emit('update:modelValue', { ...props.modelValue, ...value }) }
function setAsset(i: number, address: `0x${string}`) {
  const assets = [...props.modelValue.constituentAssets]
  assets[i] = address
  patch({ constituentAssets: assets })
}
function weight(i: number, event: Event) {
  const weights = [...props.modelValue.targetWeights]
  weights[i] = Math.round(Number((event.target as HTMLInputElement).value) * 100)
  patch({ targetWeights: weights })
}
function add() {
  if (nextAsset.value) patch({ constituentAssets: [...props.modelValue.constituentAssets, nextAsset.value.address], targetWeights: [...props.modelValue.targetWeights, 0] })
}
function remove(i: number) {
  patch({ constituentAssets: props.modelValue.constituentAssets.filter((_, j) => j !== i), targetWeights: props.modelValue.targetWeights.filter((_, j) => j !== i) })
}
function distribute() {
  const count = props.modelValue.constituentAssets.length
  if (!count) return
  const unit = Math.floor(10000 / count)
  patch({ targetWeights: Array.from({ length: count }, (_, i) => unit + (i === count - 1 ? 10000 % count : 0)) })
}
</script>

<template>
  <div class="creation-sections">
    <section class="form-section" aria-labelledby="index-section-title">
      <div class="section-title"><span>02</span><div><h3 id="index-section-title">{{ t('v13Create.title') }}</h3><p>{{ t('v13Create.help') }}</p></div></div>
      <fieldset :disabled="disabled">
        <div class="assets-heading"><span>{{ t('v13Create.asset') }}</span><span class="muted">{{ t('v13Create.assetCount') }}</span></div>
        <div v-if="loading" class="load-state" role="status"><span class="spinner" />{{ t('v13Create.loadingAssets') }}</div>
        <div v-else-if="error" class="load-state error-state" role="alert"><div><strong>{{ t('v13Create.loadError') }}</strong><p>{{ t('v13Create.loadErrorHelp') }}</p></div><button class="secondary-button" type="button" @click="emit('reload')">{{ t('v13Create.retry') }}</button></div>
        <div v-else-if="!options?.assets.length" class="load-state" role="status">{{ options ? t('v13Create.noAssets') : t('v13Create.connectForAssets') }}</div>
        <template v-else>
          <div class="asset-columns muted"><span>{{ t('v13Create.asset') }}</span><span>{{ t('v13Create.weight') }}</span><span /></div>
          <div v-for="(asset, i) in modelValue.constituentAssets" :key="i" class="asset-row">
            <IndexAssetSelect :model-value="asset" :assets="options.assets" :excluded="modelValue.constituentAssets.filter((_, j) => j !== i)" :label="`${t('v13Create.asset')} ${i + 1}`" :unavailable-label="t('v13Create.unavailableAsset')" :disabled="disabled" @update:model-value="setAsset(i, $event)" />
            <div class="percent-input" :class="{ invalid: modelValue.targetWeights[i] <= 0 }"><input :value="modelValue.targetWeights[i] / 100" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" :aria-label="`${t('v13Create.weight')} ${i + 1}`" @input="weight(i, $event)" /><span>%</span></div>
            <button class="remove-button" type="button" :disabled="modelValue.constituentAssets.length <= 1" :aria-label="`${t('v13Create.remove')} ${i + 1}`" @click="remove(i)">×</button>
          </div>
          <div class="asset-actions"><button class="secondary-button" type="button" :disabled="modelValue.constituentAssets.length >= 4 || !nextAsset" @click="add">+ {{ t('v13Create.asset') }}</button><button class="text-button" type="button" @click="distribute">{{ t('v13Create.equalWeights') }}</button><span :class="{ 'weight-warning': total !== 100 }">{{ t('v13Create.total') }} {{ amount(total) }}%</span></div>
          <p v-if="total !== 100 || modelValue.targetWeights.some(w => w <= 0)" class="weight-warning" role="status">{{ t('v13Create.weightHelp') }}</p>
        </template>
        <div class="pool-note"><strong>{{ t('v13Create.poolTitle') }}</strong><p>{{ ready && modelValue.constituentAssets.length ? t('v13Create.poolHelp', { count: modelValue.constituentAssets.length }) : t('v13Create.poolIntro') }}</p></div>
        <IndexFeeAllocation :fee-bps="modelValue.basketFeeBps" :creator-bps="modelValue.creatorShareBps" :disabled="disabled" @update:fee-bps="patch({ basketFeeBps: $event })" @update:creator-bps="patch({ creatorShareBps: $event })" />
      </fieldset>
    </section>
  </div>
</template>

<style scoped>
.creation-sections { display:grid; gap:16px; min-width:0 }
.form-section { padding:20px; border:1px solid var(--border-base); border-radius:20px; background:color-mix(in srgb,var(--surface) 94%,transparent) }
.section-title { display:flex; align-items:flex-start; gap:11px; margin-bottom:18px }
.section-title>span { display:grid; width:28px; height:28px; flex-shrink:0; place-items:center; border:1px solid rgba(254,145,63,.25); border-radius:9px; background:rgba(254,145,63,.08); color:#e77a27; font-size:9px; font-weight:800 }
h3 { margin:0; color:var(--text-base); font-size:14px; font-weight:720; line-height:18px }
p { margin:0; font-size:11px; line-height:1.65; color:var(--text-muted) }
.section-title p { margin-top:4px; font-size:10px; line-height:15px }
fieldset { display:grid; gap:14px; min-width:0; padding:0; margin:0; border:0 }
.field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; gap:14px }
label { display:grid; gap:7px; min-width:0; font-size:11px; font-weight:650; color:var(--text-base) }
input,select { box-sizing:border-box; width:100%; min-width:0; min-height:44px; padding:0 13px; border:1px solid var(--border-base); border-radius:12px; background:color-mix(in srgb,var(--surface-2) 58%,transparent); color:var(--text-base); font:inherit; font-size:12px; outline:none }
input::placeholder { color:var(--text-muted); font-weight:400 }
input:focus,select:focus,.percent-input:focus-within { border-color:#e77a27; box-shadow:0 0 0 3px rgba(254,145,63,.08) }
option { color:var(--text-base); background:var(--surface) }
small { font-size:10px; line-height:1.6; color:var(--text-muted); font-weight:400 }
.muted { color:var(--text-muted) }
.assets-heading { display:flex; justify-content:space-between; gap:10px; margin-top:3px; font-size:11px; font-weight:650 }
.assets-heading .muted { font-size:10px; font-weight:400 }
.asset-row,.asset-columns { display:grid; grid-template-columns:minmax(0,1fr) 104px 30px; gap:10px; align-items:center }
.asset-columns { font-size:10px; margin-bottom:-7px }
.percent-input { display:flex; align-items:center; min-width:0; border:1px solid var(--border-base); border-radius:12px; overflow:hidden; background:color-mix(in srgb,var(--surface-2) 58%,transparent) }
.percent-input input { border:0; border-radius:0; background:transparent; box-shadow:none; padding-right:4px }
.percent-input>span { padding-right:12px; color:var(--text-muted); font-size:12px }
.percent-input.invalid { border-color:#e77a27 }
.asset-actions { display:flex; align-items:center; flex-wrap:wrap; gap:10px; font-size:10px; color:var(--text-muted) }
.asset-actions>span { margin-left:auto }
button { cursor:pointer; font:inherit }
button:disabled { opacity:.4; cursor:not-allowed }
.secondary-button { padding:9px 12px; border:1px solid rgba(254,145,63,.24); border-radius:10px; background:rgba(254,145,63,.08); color:#e77a27; font-size:11px; font-weight:650; white-space:nowrap }
.text-button { border:0; background:none; padding:8px 0; color:var(--text-muted); font-size:10px; text-decoration:underline; text-underline-offset:3px }
.remove-button { height:36px; border:0; border-radius:9px; background:transparent; color:var(--text-muted); font-size:21px }
.remove-button:hover:not(:disabled) { background:rgba(254,145,63,.08); color:#e77a27 }
.weight-warning { color:#e77a27!important }
.pool-note { padding:13px 14px; border:1px solid var(--border-base); border-radius:12px; background:color-mix(in srgb,var(--surface-2) 35%,transparent) }
.pool-note strong { display:block; margin-bottom:5px; color:var(--text-base); font-size:11px; font-weight:650 }
.load-state { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:76px; padding:14px; border:1px solid var(--border-base); border-radius:12px; color:var(--text-muted); font-size:11px }
.load-state strong { display:block; color:var(--text-base); font-size:11px }
.load-state p { margin-top:5px; font-size:10px }
.spinner { width:15px; height:15px; border:2px solid var(--border-base); border-top-color:#e77a27; border-radius:50%; animation:spin 1s linear infinite; flex-shrink:0 }
.load-state:has(.spinner) { justify-content:flex-start }
@keyframes spin { to { transform:rotate(360deg) } }
@media(prefers-reduced-motion:reduce) { .spinner { animation:none } }
@media(max-width:480px) {
  .form-section { padding:16px; border-radius:17px }
  .field-grid { grid-template-columns:1fr }
  .asset-row,.asset-columns { grid-template-columns:minmax(0,1fr) 90px 28px; gap:7px }
  .error-state { align-items:flex-start; flex-direction:column }
  .asset-actions>span { flex-basis:100%; margin-left:0 }
}
</style>
