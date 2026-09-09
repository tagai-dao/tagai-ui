<script setup lang="ts">
import {ref,computed,watch,onUnmounted,nextTick} from 'vue'
import {useI18n} from 'vue-i18n'
import SafeAvatar from '@/components/common/SafeAvatar.vue'
import {presetBasketAssetLogo,resolveBasketAssetLogo} from '@/utils/baskets/logos'
import {formatUnits,parseUnits,zeroAddress,type Address} from 'viem'
import {useAccountStore} from '@/stores/web3'
import {useChainStore} from '@/stores/chain'
import {quoteZap,executeZap,type ZapQuote} from '@/utils/v13/zap'
import {readPoolRewards,poolAprBps,type PoolRewards} from '@/utils/v13/pool-apr'
import {readPool,operatePool,liquidity,afterPairTax,previewLiquidityAdd,type Component} from '@/utils/v13/pools'
import {previewLiquidityAddFromAsset} from '@/utils/v13/liquidity-preview'
import {poolOperationErrorKey} from '@/utils/v13/operation-error'
import {notify} from '@/utils/notify'
const props=defineProps<{token:Address;community:Address;leg:Component;symbol:string;tokenLogo?:string|null;liquidityRouter:Address|null;actionsDisabled?:boolean}>()
const emit=defineEmits<{busy:[value:boolean]}>()
const {t,locale}=useI18n(),account=useAccountStore(),chain=useChainStore()
const state=ref<Awaited<ReturnType<typeof readPool>>>(),error=ref(''),localBusy=ref(false),loading=ref(false)
const busy=computed(()=>localBusy.value||props.actionsDisabled)
watch(localBusy,value=>emit('busy',value),{flush:'sync'})
const expanded=ref(false),backButton=ref<HTMLButtonElement>()
let actionOpener:HTMLElement|undefined
function returnToFront(){
 const wasOpen=expanded.value;expanded.value=false
 if(wasOpen)void nextTick(()=>actionOpener?.isConnected&&actionOpener.focus({preventScroll:true}))
}
function closeAction(){if(!busy.value)returnToFront()}
const rewards=ref<PoolRewards>(),aprError=ref(false)
const apr=computed(()=>state.value&&rewards.value?poolAprBps(rewards.value.daily,state.value.reserveToken,state.value.supply,state.value.total,state.value.active):undefined)
const aprHint=computed(()=>aprError.value?t('v13Page.aprUnavailable'):state.value?.total===0n?t('v13Page.aprEmpty'):t('v13Page.aprHint'))
const action=ref<'deposit'|'withdraw'|'add'|'remove'|'bnb'>('deposit'),rawAmount=ref(''),slippage=ref(1)
const inputSide=ref<'token'|'asset'>('token'),rawAssetAmount=ref('')
const assetUnits=computed(()=>{
 const text=rawAssetAmount.value,decimals=state.value?.decimals??props.leg.asset_decimals??18
 if(!/^\d*(\.\d*)?$/.test(text)||(text.split('.')[1]?.length??0)>decimals)return 0n
 try{return parseUnits(text||'0',decimals)}catch{return 0n}
})
const assetPreview=computed(()=>state.value&&action.value==='add'&&inputSide.value==='asset'?previewLiquidityAddFromAsset(assetUnits.value,state.value):undefined)
const amount=computed({
 get:()=>action.value==='add'&&inputSide.value==='asset'?(assetPreview.value?formatUnits(assetPreview.value.tokenAmount,18):''):rawAmount.value,
 set:(value:string)=>{inputSide.value='token';rawAmount.value=value;rawAssetAmount.value=''},
})
const zap=ref<ZapQuote>(),quoting=ref(false),quoteError=ref('')
let quoteTimer:ReturnType<typeof setTimeout>|undefined,quoteAbort:AbortController|undefined
const slippageBps=computed(()=>Math.round(Number(slippage.value)*100))
const validSlippage=computed(()=>Number.isInteger(slippageBps.value)&&slippageBps.value>=1&&slippageBps.value<=1000)
let quoteSequence=0
const connected=computed(()=>chain.activeChainId===56&&!!account.ethConnectAddress)
let sequence=0,disposed=false
const f=(n:bigint,decimals=18)=>Number(formatUnits(n,decimals)).toLocaleString(locale.value,{maximumFractionDigits:6})
const compact=(n:bigint,decimals=18)=>new Intl.NumberFormat(locale.value,{notation:'compact',maximumFractionDigits:2}).format(Number(formatUnits(n,decimals)))
const assetSymbol=computed(()=>state.value?.symbol||props.leg.asset_symbol||`${props.leg.asset.slice(0,6)}…`)
const assetLogo=ref<string|null>(null)
watch(()=>props.leg.asset,async asset=>{
 assetLogo.value=presetBasketAssetLogo(56,asset)
 if(assetLogo.value)return
 const resolved=await resolveBasketAssetLogo(56,asset)
 if(!disposed&&props.leg.asset===asset)assetLogo.value=resolved
},{immediate:true})
const accent=computed(()=>['#fe913f','#7f9bfa','#5bbdaa','#c393ed'][props.leg.position%4])
const poolRatio=computed(()=>rewards.value?.ratio??props.leg.staking_reward_ratio??props.leg.target_weight)
const actionTitle=computed(()=>t({bnb:'v13Page.add',add:'v13Page.add',deposit:'v13Page.stake',withdraw:'v13Page.unstake',remove:'v13Page.remove'}[action.value]))
function selectLiquidityInput(value:'bnb'|'add'){
 if(busy.value||!expanded.value||!['bnb','add'].includes(action.value)||action.value===value)return
 amount.value='';error.value='';action.value=value
}
function openAction(value:typeof action.value,event:MouseEvent){
 actionOpener=event.currentTarget as HTMLElement;action.value=value;amount.value='';error.value='';expanded.value=true
 void nextTick(()=>backButton.value?.focus({preventScroll:true}))
}
const units=computed(()=>{try{return parseUnits(String(amount.value||'0'),18)}catch{return 0n}})
const addPreview=computed(()=>state.value&&action.value==='add'?previewLiquidityAdd(units.value,state.value):undefined)
const stockInput=computed({
 get:()=>inputSide.value==='asset'?rawAssetAmount.value:addPreview.value&&state.value?formatUnits(addPreview.value.assetAmount,state.value.decimals):'',
 set:(value:string)=>{rawAssetAmount.value=value;inputSide.value='asset'},
})
const estimatedLp=computed(()=>action.value==='add'?addPreview.value?.lp:action.value==='bnb'&&zap.value?.amount===units.value?zap.value.zap.lp:undefined)
const minimumLp=computed(()=>{if(!estimatedLp.value||!validSlippage.value)return undefined;const value=estimatedLp.value*BigInt(10000-slippageBps.value)/10000n;return value>0n?value:1n})
const inputSymbol=computed(()=>action.value==='bnb'?'BNB':action.value==='add'?props.symbol:'LP')
const inputBalance=computed(()=>{const s=state.value;return !s?0n:action.value==='bnb'?s.nativeBalance:action.value==='add'?s.tokenBalance:action.value==='withdraw'?s.staked:s.lpBalance})
const assetShort=computed(()=>connected.value&&!!state.value&&(inputSide.value==='asset'?assetUnits.value:(addPreview.value?.assetAmount??0n))>state.value.assetBalance)
const inputShort=computed(()=>connected.value&&!!state.value&&units.value>inputBalance.value)
const balanceError=computed(()=>inputShort.value?t('v13Page.insufficientBalance',{symbol:inputSymbol.value}):assetShort.value?t('v13Page.insufficientBalance',{symbol:assetSymbol.value}):'')
const estimated=computed(()=>{
 const s=state.value;if(!s||!s.supply||!s.reserveToken)return ''
 if(action.value==='remove')return `≈ ${f(afterPairTax(units.value*s.reserveToken/s.supply))} ${props.symbol} + ${f(units.value*s.reserveAsset/s.supply,s.decimals)} ${s.symbol}`
 return ''
})
async function refresh(){
 const seq=++sequence;loading.value=true
 const updatePool=async()=>{
  try{const value=await readPool(props.token,props.community,props.leg,(account.ethConnectAddress||zeroAddress) as Address);if(!disposed&&seq===sequence){state.value=value;error.value=''}}
  catch(e){if(!disposed&&seq===sequence){error.value=t('v13Page.loadError');console.warn('[V13 pool]',props.leg.staking_pool,e)}}
 }
 const updateApr=async()=>{
  try{const value=await readPoolRewards(props.community,props.leg.staking_pool);if(!disposed&&seq===sequence){rewards.value=value;aprError.value=false}}
  catch(e){if(!disposed&&seq===sequence){aprError.value=true;console.warn('[V13 APR]',props.leg.staking_pool,e)}}
 }
 await Promise.all([updatePool(),updateApr()]);if(seq===sequence)loading.value=false
}
function cancelQuote(clear=true){
 clearTimeout(quoteTimer);quoteTimer=undefined;quoteSequence++;quoteAbort?.abort();quoteAbort=undefined
 if(clear)zap.value=undefined
 quoting.value=false;quoteError.value=''
}
const canQuote=()=>expanded.value&&!disposed&&!busy.value&&chain.activeChainId===56&&action.value==='bnb'&&units.value>0n&&!!state.value?.supply
async function previewZap(){
 cancelQuote(false);if(!canQuote())return
 const id=quoteSequence,controller=new AbortController();quoteAbort=controller;quoting.value=true
 try{const q=await quoteZap(props.token,props.leg.position,units.value,controller.signal);if(id===quoteSequence&&!disposed)zap.value=q}
 catch(e){if(id===quoteSequence&&!controller.signal.aborted){quoteError.value=poolOperationErrorKey(e);console.warn('[V13 liquidity quote]',e)}}
 finally{if(id===quoteSequence){quoting.value=false;quoteAbort=undefined}}
}
function scheduleQuote(){
 cancelQuote();if(!canQuote())return
 quoting.value=true
 quoteTimer=setTimeout(()=>{void previewZap()},400)
}
watch([amount,action,expanded,()=>props.leg.position,()=>Boolean(state.value?.supply)],scheduleQuote,{flush:'sync'})
async function operate(claim=false){
 if(!connected.value||busy.value)return
 localBusy.value=true;error.value=''
 try{
  if(claim)await operatePool(props.token,props.community,props.leg,'claim',0n)
  else if(action.value==='bnb'){if(!zap.value||zap.value.amount!==units.value||!props.liquidityRouter)throw new Error(t('v13Page.refresh'));await executeZap(zap.value,props.liquidityRouter,zap.value.quote.metadata.subject,Math.round(slippage.value*100))}
  else if(action.value==='add'||action.value==='remove'){if(!props.liquidityRouter)throw new Error(t('v13Page.routerPending'));await liquidity(props.token,props.community,props.leg,action.value,units.value,Math.round(slippage.value*100),props.liquidityRouter,action.value==='add'?(inputSide.value==='asset'?assetUnits.value:addPreview.value?.assetAmount):undefined)}
  else await operatePool(props.token,props.community,props.leg,action.value,units.value)
  amount.value='';returnToFront();void refresh()
 }catch(e){console.warn('[V13 pool operation]',e);if(!disposed){const key=poolOperationErrorKey(e);notify({title:t('v13Operation.title'),message:t(key),type:key==='v13Operation.cancelled'?'info':'error'})}}finally{localBusy.value=false}
}
watch([()=>props.token,()=>props.community,()=>props.leg.staking_pool,()=>props.leg.pair,()=>props.leg.asset,()=>account.ethConnectAddress,()=>chain.activeChainId],()=>{expanded.value=false;sequence++;state.value=undefined;rewards.value=undefined;aprError.value=false;error.value='';amount.value='';cancelQuote();if(chain.activeChainId===56)void refresh()},{immediate:true})
const timer=setInterval(()=>{if(!busy.value&&!loading.value&&chain.activeChainId===56)void refresh();if(canQuote()&&!quoting.value)void previewZap()},20000)
defineExpose({refresh})
onUnmounted(()=>{emit('busy',false);disposed=true;sequence++;cancelQuote();clearInterval(timer)})
</script>
<template>
 <article class="pool-card" :class="{'is-flipped':expanded}" :style="{'--pool-accent':accent}" :aria-busy="loading&&!state">
  <div class="card-rotor">
  <section class="card-face card-front" :inert="expanded" :aria-hidden="expanded">
  <header class="card-header">
   <div class="pair-identity"><div class="pair-icons" aria-hidden="true"><SafeAvatar class="pair-logo" :src="tokenLogo" :seed="token" :alt="symbol" /><SafeAvatar class="pair-logo" :src="assetLogo" :seed="leg.asset" :alt="assetSymbol" /></div><div class="pair-name"><h3>{{ symbol }} <span>/</span> {{ assetSymbol }}</h3><div class="pair-meta"><span>V2 LP</span><span v-if="state" class="pool-status" :class="{'is-closed':!state.active}">{{ t(state.active?'v13Page.active':'v13Page.inactive') }}</span></div></div></div>
   <div class="ratio-badge"><strong>{{ poolRatio/100 }}<small>%</small></strong></div>
  </header>
  <div class="addresses"><a :href="`https://bscscan.com/address/${leg.pair}`" target="_blank" rel="noopener">V2 Pair ↗</a><a :href="`https://bscscan.com/address/${leg.staking_pool}`" target="_blank" rel="noopener">{{ t('v13Page.pool') }} ↗</a></div>
  <p v-if="error" class="card-error" role="alert">{{ error }}</p>
  <div v-if="!state&&loading" class="card-skeleton" aria-hidden="true"><i/><i/><i/></div>
  <button v-else-if="!state" class="secondary-button" @click="refresh">{{ t('v13Create.retry') }}</button>
  <template v-if="state">
   <div class="pool-metrics">
    <div class="apr-metric" :title="aprHint"><span>{{ t('v13Page.apr') }}</span><strong>{{ apr===undefined?'—':f(apr,2) }}<small v-if="apr!==undefined">%</small></strong></div>
    <div><span>{{ t('v13Page.totalStaked') }}</span><strong :title="f(state.total)">{{ compact(state.total) }} <small>LP</small></strong></div>
    <div><span>{{ t('v13Page.myStake') }}</span><strong :title="connected?f(state.staked):''">{{ connected?compact(state.staked):'—' }} <small>LP</small></strong></div>
   </div>
   <div class="reward-box"><div><span>{{ t('v13Page.reward') }}</span><strong :title="connected?f(state.pending):''">{{ connected?f(state.pending):'—' }} <small>{{ symbol }}</small></strong></div><button :disabled="busy||!connected||state.pending===0n" @click="operate(true)">{{ t('v13Page.claim') }} ↗</button></div>
   <div class="reserve-box"><span>{{ t('v13Page.reserves') }}</span><div><span :title="f(state.reserveToken)">{{ compact(state.reserveToken) }} <b>{{ symbol }}</b></span><span :title="f(state.reserveAsset,state.decimals)">{{ compact(state.reserveAsset,state.decimals) }} <b>{{ assetSymbol }}</b></span></div></div>
   <p v-if="!state.active" class="pool-note">{{ t('v13Page.closed') }}</p>
   <div class="card-actions"><button class="primary-button" :disabled="busy||!state.supply||!liquidityRouter" @click="openAction('bnb',$event)">+ {{ t('v13Page.add') }}</button><button class="secondary-button" :disabled="busy||!state.active" @click="openAction('deposit',$event)">{{ t('v13Page.stake') }}</button></div>
   <div class="secondary-actions"><button :disabled="busy" @click="openAction('withdraw',$event)">{{ t('v13Page.unstake') }}</button><span>·</span><button :disabled="busy||!state.supply||!liquidityRouter" @click="openAction('remove',$event)">{{ t('v13Page.remove') }}</button></div>
  </template>
  </section>
  <section class="card-face card-back" :inert="!expanded" :aria-hidden="!expanded" @keydown.esc.stop.prevent="closeAction">
   <header class="back-header"><button ref="backButton" class="back-button" :disabled="busy" @click="closeAction"><span aria-hidden="true">←</span> {{ t('back') }}</button><span>{{ symbol }} / {{ assetSymbol }}</span></header>
   <h3 class="operation-title">{{ actionTitle }}</h3>
   <template v-if="state">
   <div class="operation-panel">
   <p v-if="error" class="card-error" role="alert">{{ error }}</p>
   <div class="controls">
    <div v-if="action==='bnb'||action==='add'" class="liquidity-input-toggle" role="group" :aria-label="t('v13Page.add')">
     <button type="button" :aria-pressed="action==='bnb'" :disabled="busy" :title="t('v13Page.bnbAdd')" @click="selectLiquidityInput('bnb')">BNB</button>
     <button type="button" :aria-pressed="action==='add'" :disabled="busy" :title="t('v13Page.dualAdd')" @click="selectLiquidityInput('add')">{{ symbol }} + {{ assetSymbol }}</button>
    </div>
    <div class="amount-field" :class="{'has-error':inputShort}"><label><span>{{ t('v13Page.amount') }} · {{ inputSymbol }}</span><input v-model="amount" type="text" inputmode="decimal" autocomplete="off" :disabled="busy" /></label><div class="input-footer"><button v-if="action!=='bnb'" :disabled="busy||!connected" @click="amount=formatUnits(inputBalance,18)">MAX</button><span :title="connected?formatUnits(inputBalance,18):''">{{ t(action==='withdraw'?'v13Page.myStake':'balance') }}: {{ connected?f(inputBalance):'—' }} {{ inputSymbol }}</span></div></div>
    <template v-if="action==='add'"><div class="pair-plus" aria-hidden="true">+</div><div class="amount-field asset-field" :class="{'has-error':assetShort}"><label><span>{{ t('v13Page.amount') }} · {{ assetSymbol }}</span><input v-model="stockInput" placeholder="0" type="text" inputmode="decimal" autocomplete="off" :disabled="busy" /></label><div class="input-footer"><button :disabled="busy||!connected" @click="stockInput=formatUnits(state.assetBalance,state.decimals)">MAX</button><span :title="connected?formatUnits(state.assetBalance,state.decimals):''">{{ t('balance') }}: {{ connected?f(state.assetBalance,state.decimals):'—' }} {{ assetSymbol }}</span></div></div><p class="ratio-help">{{ t('v13Page.assetRatioHelp') }}</p></template>
   </div>
   <p v-if="balanceError" class="balance-error" role="alert">{{ balanceError }}</p>
   <div v-if="action==='bnb'||action==='add'" class="lp-estimate"><span>{{ t('v13Page.estimatedLp') }}</span><strong :title="estimatedLp!==undefined?f(estimatedLp)+' LP':''"><template v-if="quoting&&!zap"><small role="status">{{ t('v13Page.quotingLp') }}</small></template><template v-else>{{ estimatedLp!==undefined?'≈ '+f(estimatedLp):'—' }} <small>LP</small></template></strong></div>
   <div v-if="action==='bnb'||action==='add'||action==='remove'" class="controls"><label class="slippage-field">{{ t('v13Page.slippage') }} %<input v-model.number="slippage" type="number" min="0.01" max="10" step="0.01" :disabled="busy" /></label></div>
   <p v-if="minimumLp!==undefined" class="lp-minimum">{{ t('v13Page.minimumLp') }}: {{ f(minimumLp) }} LP</p>
   <p v-if="!liquidityRouter">{{ t('v13Page.routerPending') }}</p>
   <template v-if="action==='bnb'">
    <p v-if="quoteError" role="alert">{{ t(quoteError) }}</p>
    <button :disabled="quoting||busy||units<=0n||!state.supply" @click="previewZap">{{ t('v13Trade.refresh') }}</button>
   </template>
   <p v-if="estimated">{{ estimated }}</p>
   </div>
   <footer class="operation-footer">
   <button class="primary-button confirm-button" :disabled="busy||!connected||units<=0n||!!balanceError||(['bnb','add','remove'].includes(action)&&!validSlippage)||(action==='add'&&(!addPreview?.lp||!liquidityRouter))||(action==='remove'&&!liquidityRouter)||(action==='bnb'&&(!zap||quoting||!liquidityRouter||!zap.quote.snapshot.executable))||(action==='deposit'&&!state.active)" @click="operate()">{{ busy?t('v13Page.wait'):t('v13Page.confirm') }}</button>
   </footer>
   </template>
  </section>
  </div>
 </article>
</template>
<style scoped>
.pool-card{--pool-accent:#fe913f;position:relative;min-width:0;width:100%;max-width:460px;box-sizing:border-box;align-self:start;perspective:1400px}
.card-rotor{position:relative;width:100%;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.22,.68,.22,1)}.is-flipped .card-rotor{transform:rotateY(180deg)}
.card-face{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;min-width:0;padding:22px;border:1px solid var(--border-base,#292d34);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--pool-accent) 5%,var(--surface)),var(--surface) 45%);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 6px 24px #00000008;overflow:hidden;transition:border-color .2s;box-sizing:border-box}.card-front{position:relative}.card-back{transform:rotateY(180deg)}.card-face:before{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(var(--pool-accent),transparent 55%);opacity:.75;pointer-events:none}.pool-card:hover .card-face{border-color:color-mix(in srgb,var(--pool-accent) 40%,var(--border-base))}
.back-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}.back-header>span{font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.back-button{display:flex;align-items:center;gap:7px;padding:5px 0;border:0;background:transparent;color:var(--pool-accent);font-size:12px}.back-button>span{font-size:20px;line-height:1}.back-button:focus-visible{outline:2px solid var(--pool-accent);outline-offset:3px;border-radius:4px}.operation-title{font-size:18px;font-weight:750;flex-shrink:0}.operation-footer{flex-shrink:0;padding-top:12px;border-top:1px solid var(--border-base)}

.card-header{display:flex;gap:10px;align-items:center;justify-content:space-between}.pair-identity{display:flex;gap:12px;align-items:center;min-width:0}.pair-icons{display:flex;flex-shrink:0}.pair-logo{display:block;flex-shrink:0;width:36px;height:36px;box-sizing:border-box;border-radius:50%;object-fit:cover;background:var(--surface);border:2px solid var(--surface)}.pair-logo+.pair-logo{margin-left:-11px}.pair-name{min-width:0}.pair-name h3{font-size:15px;font-weight:750;line-height:1.4;overflow-wrap:anywhere}.pair-name h3 span{color:var(--text-muted);font-weight:400;margin:0 3px}.pair-meta{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:10px;color:var(--text-muted)}.pair-meta>span:first-child{padding:2px 6px;border:1px solid var(--border-base);border-radius:5px;font-weight:650;letter-spacing:.05em}.pool-status{display:flex;align-items:center;gap:4px}.pool-status:before{content:'';width:5px;height:5px;background:#58b79b;border-radius:50%}.pool-status.is-closed:before{background:var(--text-muted)}
button{cursor:pointer;font:inherit}button:disabled{opacity:.4;cursor:not-allowed}
.ratio-badge{flex-shrink:0;display:grid;gap:3px;min-width:66px;max-width:100px;padding:8px 10px;text-align:center;border-radius:12px;background:color-mix(in srgb,var(--pool-accent) 12%,var(--surface));border:1px solid color-mix(in srgb,var(--pool-accent) 30%,var(--border-base));color:#ff9f43}.ratio-badge strong{font-size:28px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}.ratio-badge small{font-size:13px;color:inherit;margin-left:2px}

.addresses{display:flex;gap:12px;align-items:center;font-size:10px;color:var(--text-muted)}.addresses a:hover{color:var(--pool-accent)}small{font-size:11px;font-weight:500;letter-spacing:0;color:var(--text-muted)}
.pool-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px;padding:16px 0;border-top:1px solid var(--border-base);border-bottom:1px solid var(--border-base)}.pool-metrics>div{display:flex;flex-direction:column;justify-content:center;gap:7px;min-width:0}.pool-metrics>div:last-child{border-left:1px solid var(--border-base);padding-left:10px}.pool-metrics span,.reward-box span{font-size:10px;color:var(--text-muted)}.pool-metrics strong{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;line-height:1.3}.pool-metrics .apr-metric{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border-base)}.pool-metrics .apr-metric strong{font-size:25px;font-weight:800;color:#52ce9f}.apr-metric small{font-size:13px;color:inherit;margin-left:2px}
.reward-box{display:flex;align-items:center;justify-content:space-between;gap:8px;background:color-mix(in srgb,var(--pool-accent) 7%,var(--surface));border:1px solid color-mix(in srgb,var(--pool-accent) 18%,var(--border-base));padding:13px;border-radius:13px}.reward-box>div{display:grid;gap:5px;min-width:0}.reward-box strong{font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.reward-box button{color:var(--pool-accent);border:0;background:transparent;font-size:12px;white-space:nowrap;padding:7px 0 7px 8px}
.reserve-box{display:grid;gap:8px;font-size:10px;color:var(--text-muted)}.reserve-box>div{display:flex;justify-content:space-between;gap:10px;font-size:12px;flex-wrap:wrap}.reserve-box b{font-size:10px;font-weight:500;color:var(--text-muted)}.reserve-box>div>span{color:var(--text-base);font-variant-numeric:tabular-nums}.card-actions{display:grid;grid-template-columns:1.15fr 1fr;gap:9px}.primary-button,.secondary-button{min-height:40px;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:650}.primary-button{background:linear-gradient(110deg,#ff9b48,#ee7c2c);border:1px solid #ed873f;color:#18130f}.secondary-button{background:transparent;border:1px solid var(--border-base);color:var(--text-base)}.secondary-actions{display:flex;align-items:center;justify-content:center;gap:9px;color:var(--text-muted);font-size:10px;margin-top:-5px}.secondary-actions button{background:transparent;border:0;padding:3px}.secondary-actions button:hover{color:var(--pool-accent)}.secondary-actions .collapse-button{margin-left:auto;padding:0 6px;font-size:18px}
p{font-size:11px;color:var(--text-muted);line-height:1.65;margin:0}.pool-note{color:var(--pool-accent)}.card-error,[role=alert]{color:#e78a38}.card-error{padding:9px 12px;background:#fe913f0c;border-radius:8px}.operation-panel{display:grid;align-content:start;flex:1;min-height:0;gap:12px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:2px 3px 8px 0}.controls{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.controls label{display:grid;gap:7px;min-width:0;font-size:11px;color:var(--text-muted)}.controls input,.operation-panel>button:not(.primary-button){min-width:0;width:100%;border:1px solid var(--border-base);border-radius:9px;padding:10px;background:var(--surface);color:var(--text-base);font-size:12px}.controls input{font-variant-numeric:tabular-nums}.controls input:focus-visible{outline:1px solid var(--pool-accent)}
.amount-field{min-width:0}.controls .amount-field>label{display:flex;align-items:center;gap:10px;min-height:44px;box-sizing:border-box;padding:7px 12px;border:1px solid var(--border-base);border-radius:10px;background:color-mix(in srgb,var(--text-muted) 4%,var(--surface))}.amount-field>label>span{flex-shrink:0;max-width:45%;line-height:1.3}.amount-field:focus-within>label{border-color:var(--pool-accent)}.amount-field.has-error>label{border-color:#e27070}.amount-field input{flex:1;min-width:0;width:0;height:28px;min-height:0;box-sizing:border-box;padding:0;border:0;border-radius:0;background:transparent;font-size:16px;line-height:28px;text-align:right;outline:0;box-shadow:none}.amount-field input:focus-visible{outline:0}.input-footer{display:flex;align-items:baseline;justify-content:flex-end;gap:8px;min-height:14px;margin-top:4px;font-size:10px;color:var(--text-muted);font-variant-numeric:tabular-nums}.input-footer>span{text-align:right;overflow-wrap:anywhere}.input-footer>button{padding:0;background:transparent;border:0;color:var(--pool-accent);font-size:10px;font-weight:700;margin-right:auto}.pair-plus{display:grid;place-items:center;justify-self:center;width:24px;height:24px;margin:-4px 0;z-index:1;border:1px solid var(--border-base);border-radius:50%;background:var(--surface);color:var(--pool-accent);font-size:17px}.asset-field input{color:var(--pool-accent)}.ratio-help{font-size:10px}.controls .slippage-field{display:flex;align-items:center;justify-content:space-between;gap:12px}.slippage-field input{width:78px;flex-shrink:0;text-align:right}.balance-error{color:#e27070}
.lp-estimate{min-height:44px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--pool-accent) 25%,var(--border-base));border-radius:10px;background:color-mix(in srgb,var(--pool-accent) 6%,var(--surface));font-variant-numeric:tabular-nums}.lp-estimate>span{font-size:11px;color:var(--text-muted);flex-shrink:0}.lp-estimate strong{min-width:0;font-size:16px;line-height:24px;font-weight:750;color:var(--pool-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lp-minimum{font-size:10px}.lp-estimate small{color:var(--pool-accent)}
.confirm-button{width:100%}.card-skeleton{display:grid;gap:15px;padding:12px 0}.card-skeleton i{height:42px;border-radius:10px;background:var(--border-base);opacity:.5}.card-skeleton i:first-child{width:60%;height:30px}
@media(max-width:420px){.card-face{padding:18px;gap:12px;border-radius:18px}.pair-logo{width:30px;height:30px}.pair-name h3{font-size:14px}.addresses{gap:8px}.pool-metrics{gap:7px}.pool-metrics>div:last-child{padding-left:7px}.pool-metrics strong{font-size:15px}.pool-metrics .apr-metric strong{font-size:22px}}
@media(prefers-reduced-motion:reduce){.card-rotor,.card-face{transition:none}}

.liquidity-input-toggle{display:flex;gap:4px;padding:4px;border:1px solid var(--border-base);border-radius:12px;background:var(--surface)}
.liquidity-input-toggle button{flex:1;min-width:0;border:0;border-radius:8px;padding:9px 8px;font-size:12px;font-weight:650;color:var(--text-muted);background:transparent;overflow-wrap:anywhere;transition:background .15s,color .15s}
.liquidity-input-toggle button[aria-pressed="true"]{background:linear-gradient(110deg,#ff9b48,#ee7c2c);color:#18130f}
.liquidity-input-toggle button:focus-visible{outline:2px solid var(--pool-accent);outline-offset:2px}
</style>
