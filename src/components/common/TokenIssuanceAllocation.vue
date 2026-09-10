<script setup lang="ts">
import {useI18n} from 'vue-i18n'
defineProps<{modelValue:boolean;disabled?:boolean}>()
const emit=defineEmits<{(e:'update:modelValue',value:boolean):void}>()
const {t}=useI18n()
</script>
<template>
 <section class="issuance-allocation" :aria-label="t('v13Issuance.title')">
  <header><h3>{{ t('v13Issuance.title') }}</h3><span>{{ t('v13Issuance.total') }} <strong>{{ t('v13Issuance.supply') }}</strong></span></header>
  <div class="allocation-bar" aria-hidden="true"><div class="curve">65%</div><div class="lp">20%</div><div class="mining">15%</div></div>
  <div class="allocation-legend"><span><i class="curve"/>Bonding Curve</span><span><i class="lp"/>Dex</span><span><i class="mining"/>{{ t('v13Issuance.mining') }}</span></div>
  <ul class="allocation-details">
   <li>{{ t('v13Issuance.curveDetail') }}</li>
   <li>{{ t('v13Issuance.v4Detail') }}</li>
   <li>{{ t('v13Issuance.v2Detail') }}</li>
   <li>{{ t('v13Issuance.miningDetail') }}
    <label class="ownership"><input type="checkbox" :checked="modelValue" :disabled="disabled" @change="emit('update:modelValue',($event.target as HTMLInputElement).checked)"/><span>{{ t('v13Issuance.retain') }}</span></label>
   </li>
  </ul>
 </section>
</template>
<style scoped>
.issuance-allocation{margin-top:22px;padding-top:20px;border-top:1px solid var(--border-base)}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}h3{margin:0;font-size:14px;font-weight:720;color:var(--text-base)}header>span{font-size:11px;color:var(--text-muted);text-align:right}header strong{margin-left:5px;color:var(--text-base);font-weight:700;white-space:nowrap}
.allocation-bar{display:flex;height:32px;overflow:hidden;border-radius:9px;gap:2px}.allocation-bar>div{display:flex;align-items:center;justify-content:center;min-width:0;color:#17191c;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}.curve{background:#fe913f}.lp{background:#55bda7}.mining{background:#a998ee}.allocation-bar .curve{flex:65}.allocation-bar .lp{flex:20}.allocation-bar .mining{flex:15}
.allocation-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;color:var(--text-muted);font-size:10px}.allocation-legend span{display:flex;align-items:center;gap:6px}.allocation-legend i{width:7px;height:7px;border-radius:2px}
.allocation-details{margin:18px 0 0;padding-left:18px;list-style:disc outside;color:var(--text-muted);font-size:11px;line-height:1.8;display:grid;gap:8px}.allocation-details>li{display:list-item}.allocation-details li::marker{color:#fe913f}.ownership{display:flex;align-items:flex-start;gap:8px;margin:8px 0 0 18px;color:var(--text-base);font-size:11px;cursor:pointer}.ownership input{flex-shrink:0;width:15px;height:15px;margin-top:3px;accent-color:#fe913f}.ownership:has(input:disabled){opacity:.5;cursor:not-allowed}
@media(max-width:480px){.issuance-allocation{margin-top:18px;padding-top:16px}.allocation-legend{gap:12px}header{align-items:flex-start}}
</style>
