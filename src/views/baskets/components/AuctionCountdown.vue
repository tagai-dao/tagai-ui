<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
const props=defineProps<{endTime:number;now?:number}>()
const {t,locale}=useI18n()
const remaining=computed(()=>props.now===undefined?undefined:Math.max(0,Math.ceil((props.endTime*1000-props.now)/1000)))
const urgent=computed(()=>remaining.value!==undefined&&remaining.value>0&&remaining.value<=60)
const ended=computed(()=>remaining.value===0)
const digits=computed(()=>[
 {unit:'hours',value:remaining.value===undefined?'—':String(Math.floor(remaining.value/3600)).padStart(2,'0')},
 {unit:'minutes',value:remaining.value===undefined?'—':String(Math.floor(remaining.value/60)%60).padStart(2,'0')},
 {unit:'seconds',value:remaining.value===undefined?'—':String(remaining.value%60).padStart(2,'0')},
])
const accessibleTime=computed(()=>digits.value.map(part=>`${part.value} ${t('auctionCountdown.'+part.unit)}`).join(' '))
const endLabel=computed(()=>t('baskets.endsAt',{time:new Date(props.endTime*1000).toLocaleString(locale.value)}))
</script>
<template>
 <div class="auction-countdown" :class="{'is-urgent':urgent,'is-ended':ended}">
  <div class="countdown-label"><i aria-hidden="true"/>{{ t(ended?'baskets.readyToSettle':urgent?'auctionCountdown.lastMinute':'auctionCountdown.remaining') }}</div>
  <div v-if="!ended" class="countdown-digits" role="timer" aria-live="off" :aria-label="accessibleTime">
   <template v-for="(part,index) in digits" :key="part.unit">
    <span v-if="index" class="countdown-colon" aria-hidden="true">:</span>
    <div class="countdown-unit" aria-hidden="true"><div class="digit-window"><Transition name="countdown-roll"><strong :key="part.value">{{ part.value }}</strong></Transition></div><small>{{ t('auctionCountdown.'+part.unit) }}</small></div>
   </template>
  </div>
  <div v-if="urgent" class="last-minute-track" aria-hidden="true"><i :style="{transform:`scaleX(${(remaining??0)/60})`}"/></div>
  <div class="countdown-end-time">{{ endLabel }}</div>
 </div>
</template>
<style scoped>
.auction-countdown{--countdown-color:#ab9aff;min-width:230px;max-width:100%;box-sizing:border-box;padding:12px 16px;border:1px solid #a18afd45;border-radius:14px;background:linear-gradient(125deg,#9477f519,#25253933);color:var(--countdown-color)}
.countdown-label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:650;line-height:1.4}.countdown-label i{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.countdown-digits{display:flex;align-items:flex-start;justify-content:center;gap:8px;margin-top:8px}.countdown-unit{display:grid;text-align:center;gap:3px;min-width:48px}.digit-window{position:relative;overflow:hidden;height:38px;min-width:48px}.digit-window strong{display:block;font-size:32px;line-height:38px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.025em;color:inherit}.countdown-unit small{font-size:9px;color:var(--text-muted)}.countdown-colon{font-size:25px;line-height:34px;font-weight:600;opacity:.7}.countdown-end-time{margin-top:8px;font-size:9px;line-height:1.5;color:var(--text-muted);overflow-wrap:anywhere}
.countdown-roll-enter-active,.countdown-roll-leave-active{transition:transform .25s ease,opacity .25s ease}.countdown-roll-enter-from{transform:translateY(-75%);opacity:0}.countdown-roll-leave-to{transform:translateY(75%);opacity:0}.countdown-roll-leave-active{position:absolute;inset:0}
.is-urgent{--countdown-color:#ff6377;border-color:#ff637799;background:linear-gradient(125deg,#ef3f5624,#d82c4010);animation:countdown-pulse 1.4s ease-in-out infinite}.is-urgent .digit-window strong{text-shadow:0 0 15px #ff637738}.last-minute-track{height:3px;overflow:hidden;border-radius:3px;background:#ff637725;margin-top:9px}.last-minute-track i{display:block;width:100%;height:100%;background:#ff6377;transform-origin:left;transition:transform 1s linear}.is-ended{--countdown-color:#fe913f;border-color:#fe913f45;background:#fe913f0b}.is-ended .countdown-label{font-size:15px}
@keyframes countdown-pulse{0%,100%{box-shadow:0 0 0 0 #ff637700}50%{box-shadow:0 0 0 3px #ff637716,0 0 20px #ff637714}}
@media(max-width:420px){.auction-countdown{width:100%;min-width:0}.countdown-digits{gap:12px}.countdown-unit{min-width:50px}}
@media(prefers-reduced-motion:reduce){.is-urgent{animation:none}.countdown-roll-enter-active,.countdown-roll-leave-active,.last-minute-track i{transition:none}}
</style>
