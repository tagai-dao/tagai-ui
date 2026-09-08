<script setup lang="ts">
import {ref,computed,watch,onUnmounted} from 'vue'
import {useI18n} from 'vue-i18n'
import {formatUnits,parseUnits,zeroAddress,type Address} from 'viem'
import {useAccountStore} from '@/stores/web3'
import {useChainStore} from '@/stores/chain'
import {quoteZap,executeZap,type ZapQuote} from '@/utils/v13/zap'
import {readPool,operatePool,liquidity,afterPairTax,type Component} from '@/utils/v13/pools'
const props=defineProps<{token:Address;community:Address;leg:Component;symbol:string;liquidityRouter:Address|null}>()
const {t}=useI18n(),account=useAccountStore(),chain=useChainStore()
const state=ref<Awaited<ReturnType<typeof readPool>>>(),error=ref(''),busy=ref(false),loading=ref(false)
const action=ref<'deposit'|'withdraw'|'add'|'remove'|'bnb'>('deposit'),amount=ref(''),slippage=ref(1)
const zap=ref<ZapQuote>(),quoting=ref(false),quoteError=ref('')
let quoteTimer:ReturnType<typeof setTimeout>|undefined,quoteAbort:AbortController|undefined
const slippageBps=computed(()=>Math.round(Number(slippage.value)*100))
const validSlippage=computed(()=>Number.isInteger(slippageBps.value)&&slippageBps.value>=1&&slippageBps.value<=1000)
const minimumLp=computed(()=>{if(!zap.value||!validSlippage.value)return undefined;const value=zap.value.zap.lp*BigInt(10000-slippageBps.value)/10000n;return value>0n?value:1n})
let quoteSequence=0
const connected=computed(()=>chain.activeChainId===56&&!!account.ethConnectAddress)
let sequence=0,disposed=false
const f=(n:bigint,decimals=18)=>Number(formatUnits(n,decimals)).toLocaleString(undefined,{maximumFractionDigits:6})
const units=computed(()=>{try{return parseUnits(amount.value||'0',18)}catch{return 0n}})
const estimated=computed(()=>{
 const s=state.value;if(!s||!s.supply||!s.reserveToken)return ''
 if(action.value==='add')return `${f(afterPairTax(units.value)*s.reserveAsset/s.reserveToken,s.decimals)} ${s.symbol} · ≈ ${f(afterPairTax(units.value)*s.supply/s.reserveToken)} LP`
 if(action.value==='remove')return `≈ ${f(afterPairTax(units.value*s.reserveToken/s.supply))} ${props.symbol} + ${f(units.value*s.reserveAsset/s.supply,s.decimals)} ${s.symbol}`
 return ''
})
async function refresh(){
 const seq=++sequence;loading.value=true
 try{const value=await readPool(props.token,props.community,props.leg,(account.ethConnectAddress||zeroAddress) as Address);if(!disposed&&seq===sequence){state.value=value;error.value=''}}
 catch(e){if(seq===sequence){state.value=undefined;error.value=t('v13Page.loadError')}}finally{if(seq===sequence)loading.value=false}
}
function cancelQuote(){
 clearTimeout(quoteTimer);quoteTimer=undefined;quoteSequence++;quoteAbort?.abort();quoteAbort=undefined
 zap.value=undefined;quoting.value=false;quoteError.value=''
}
const canQuote=()=>!disposed&&!busy.value&&chain.activeChainId===56&&action.value==='bnb'&&units.value>0n&&!!state.value?.supply
async function previewZap(){
 cancelQuote();if(!canQuote())return
 const id=quoteSequence,controller=new AbortController();quoteAbort=controller;quoting.value=true
 try{const q=await quoteZap(props.token,props.leg.position,units.value,controller.signal);if(id===quoteSequence&&!disposed)zap.value=q}
 catch(e){if(id===quoteSequence&&!controller.signal.aborted)quoteError.value=e instanceof Error?e.message:String(e)}
 finally{if(id===quoteSequence){quoting.value=false;quoteAbort=undefined}}
}
function scheduleQuote(){
 cancelQuote();if(!canQuote())return
 quoting.value=true
 quoteTimer=setTimeout(()=>{void previewZap()},400)
}
watch([amount,action,()=>props.leg.position,()=>Boolean(state.value?.supply)],scheduleQuote,{flush:'sync'})
async function operate(claim=false){
 if(!connected.value||busy.value)return
 const adding=!claim&&(action.value==='bnb'||action.value==='add'),beforeLP=state.value?.lpBalance||0n
 busy.value=true;error.value=''
 try{
  if(claim)await operatePool(props.token,props.community,props.leg,'claim',0n)
  else if(action.value==='bnb'){if(!zap.value||zap.value.amount!==units.value||!props.liquidityRouter)throw new Error(t('v13Page.refresh'));await executeZap(zap.value,props.liquidityRouter,zap.value.quote.metadata.subject,Math.round(slippage.value*100));action.value='deposit'}
  else if(action.value==='add'||action.value==='remove'){if(!props.liquidityRouter)throw new Error(t('v13Page.routerPending'));await liquidity(props.token,props.community,props.leg,action.value,units.value,Math.round(slippage.value*100),props.liquidityRouter);if(action.value==='add')action.value='deposit'}
  else await operatePool(props.token,props.community,props.leg,action.value,units.value)
  amount.value='';await refresh()
  if(adding&&state.value&&state.value.lpBalance>beforeLP)amount.value=formatUnits(state.value.lpBalance-beforeLP,18)
 }catch(e){error.value=e instanceof Error?e.message:String(e)}finally{busy.value=false}
}
watch(()=>[props.token,props.leg.staking_pool,account.ethConnectAddress,chain.activeChainId],()=>{state.value=undefined;amount.value='';cancelQuote();if(chain.activeChainId===56)void refresh()},{immediate:true})
const timer=setInterval(()=>{if(!busy.value&&!loading.value&&chain.activeChainId===56)void refresh();if(canQuote()&&!quoting.value)void previewZap()},20000)
onUnmounted(()=>{disposed=true;sequence++;cancelQuote();clearInterval(timer)})
</script>
<template>
 <article class="pool-card">
  <header><h3>{{ symbol }} / {{ state?.symbol || `${leg.asset.slice(0,6)}…` }}</h3><span>{{ state ? state.rewardRatio/100+'%' : '—' }} {{ t('v13Page.rewardRatio') }}</span></header>
  <div class="addresses"><a :href="`https://bscscan.com/address/${leg.pair}`" target="_blank" rel="noopener">V2 Pair ↗</a><a :href="`https://bscscan.com/address/${leg.staking_pool}`" target="_blank" rel="noopener">{{ t('v13Page.pool') }} ↗</a></div>
  <p v-if="error" role="alert">{{ error }}</p><button v-if="!state" @click="refresh" :disabled="loading">{{ t('v13Create.retry') }}</button>
  <template v-if="state">
   <p v-if="!state.supply">{{ t('v13Page.unseeded') }}</p>
   <p v-if="!state.active">{{ t('v13Page.closed') }}</p>
   <dl><dt>{{ t('v13Page.reserves') }}</dt><dd>{{ f(state.reserveToken) }} {{ symbol }} / {{ f(state.reserveAsset,state.decimals) }} {{ state.symbol }}</dd><dt>{{ t('v13Page.totalStaked') }}</dt><dd>{{ f(state.total) }} LP</dd><dt>{{ t('v13Page.myStake') }}</dt><dd>{{ connected?f(state.staked):'—' }} LP</dd><dt>{{ t('v13Page.lpBalance') }}</dt><dd>{{ connected?f(state.lpBalance):'—' }} LP</dd><dt>{{ t('v13Page.reward') }}</dt><dd>{{ connected?f(state.pending):'—' }} {{ symbol }}</dd></dl>
   <button :disabled="busy||!connected||state.pending===0n" @click="operate(true)">{{ t('v13Page.claim') }}</button>
   <div class="controls"><select v-model="action" :disabled="busy"><option value="bnb">{{ t('v13Page.bnbAdd') }}</option><option value="deposit">{{ t('v13Page.stake') }}</option><option value="withdraw">{{ t('v13Page.unstake') }}</option><option value="add" :disabled="!liquidityRouter">{{ t('v13Page.add') }}</option><option value="remove" :disabled="!liquidityRouter">{{ t('v13Page.remove') }}</option></select>
    <label>{{ t('v13Page.amount') }} ({{ action==='bnb'?'BNB':action==='add'?symbol:'LP' }})<input v-model="amount" type="number" min="0" step="any" :disabled="busy" /></label>
    <button v-if="action==='deposit'||action==='withdraw'||action==='remove'" :disabled="busy||!connected" @click="amount=formatUnits(action==='withdraw'?state.staked:state.lpBalance,18)">Max LP</button>
    <label v-if="action==='bnb'||action==='add'||action==='remove'">{{ t('v13Page.slippage') }} %<input v-model.number="slippage" type="number" min="0.01" max="10" step="0.01" :disabled="busy" /></label>
   </div>
   <p v-if="!liquidityRouter">{{ t('v13Page.routerPending') }}</p>
   <template v-if="action==='bnb'">
    <p>{{ t('v13Page.bnbRoute') }}</p>
    <p v-if="quoting" role="status">{{ t('v13Page.quotingLp') }}</p>
    <p v-if="quoteError" role="alert">{{ quoteError }}</p>
    <button :disabled="quoting||busy||units<=0n||!state.supply" @click="previewZap">{{ t('v13Trade.refresh') }}</button>
    <p v-if="zap">{{ t('v13Page.estimatedLp') }}: ≈ {{ formatUnits(zap.zap.lp,18) }} LP · {{ f(zap.zap.tokenBnb) }} BNB → {{ symbol }} / {{ f(zap.zap.assetBnb) }} BNB → {{ state.symbol }}</p>
    <p v-if="minimumLp!==undefined">{{ t('v13Page.minimumLp') }}: {{ formatUnits(minimumLp,18) }} LP</p>
    <p v-if="zap">{{ t('v13Page.bnbRefund') }}: ≈ {{ formatUnits(zap.zap.refundBnb,18) }} BNB</p>
    <p>{{ t('v13Page.bnbDust') }}</p>
   </template>
   <p v-if="estimated">{{ estimated }}</p><p v-if="action==='bnb'||action==='add'||action==='remove'">{{ t('v13Page.tax') }}</p>
   <p>{{ t('v13Page.operationFee') }}: {{ formatUnits(state.fee,18) }} BNB</p>
   <p>{{ t('v13Page.twoSteps') }}</p>
   <p v-if="action==='add'">{{ t('v13Page.refund') }}</p>
   <button :disabled="busy||!connected||units<=0n||(action==='bnb'&&(!zap||quoting||!liquidityRouter||!zap.quote.snapshot.executable||!validSlippage))||(action==='deposit'&&!state.active)" @click="operate()">{{ busy?t('v13Page.wait'):t('v13Page.confirm') }}</button>
  </template>
 </article>
</template>
<style scoped>
.pool-card{padding:20px;border:1px solid var(--border-base,#ddd);border-radius:16px;display:grid;gap:12px}header{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between}h3{font-weight:700}.addresses{display:flex;gap:16px;font-size:12px}dl{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:14px}dt,p{color:var(--text-muted,#777)}p{font-size:13px}.controls{display:flex;flex-wrap:wrap;gap:10px}label{display:grid;gap:5px;flex:1;min-width:120px}input,select,button{border:1px solid var(--border-base,#ddd);border-radius:8px;padding:9px;background:var(--surface-1,transparent);min-width:0}button:disabled{opacity:.4}[role=alert]{color:#d66a00}
</style>
