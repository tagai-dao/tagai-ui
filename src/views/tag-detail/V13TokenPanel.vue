<script setup lang="ts">
import {getChainDeployment} from '@/config/chains'
import {ref,computed,watch,onUnmounted} from 'vue'
import {useI18n} from 'vue-i18n'
import {type Address,type Abi,formatUnits,zeroAddress} from 'viem'
import {useCommunityStore} from '@/stores/community'
import {useAccountStore} from '@/stores/web3'
import {formatPrice,formatAmount} from '@/utils/helper'
import {useChainStore} from '@/stores/chain'
import {claimAllPoolRewards,getV13Detail,send,walletGuard,type V13Detail} from '@/utils/v13/pools'
import {readLifecycle,CURVE_CAP} from '@/utils/v13/lifecycle'
import {getReadOnlyClient} from '@/utils/wallets'
import tokenAbi from '@/utils/v13/Token13.json'
import V13PoolCard from './V13PoolCard.vue'
import {notify} from '@/utils/notify'
import {poolOperationErrorKey} from '@/utils/v13/operation-error'
const liquidityRouter=getChainDeployment(56).contracts.liquidityRouter13??null
const props=defineProps<{mining?:boolean}>()
const {t,locale}=useI18n(),store=useCommunityStore(),account=useAccountStore(),chain=useChainStore()
const token=computed(()=>store.currentSelectedCommunity?.token as Address),symbol=computed(()=>store.currentSelectedCommunity?.tick||'Token')
const data=ref<V13Detail>(),state=ref<Awaited<ReturnType<typeof readLifecycle>>>(),pending=ref<bigint>(),error=ref(''),loading=ref(false),busy=ref(false)
const claimingAll=ref(false),poolCards=ref<Array<{refresh:()=>Promise<void>}>>([])
const poolBusy=ref<Record<string,boolean>>({})
const canClaimAll=computed(()=>chain.activeChainId===56&&!!account.ethConnectAddress&&account.ethConnectAddress!==zeroAddress&&!!data.value?.components.length&&!claimingAll.value&&!Object.values(poolBusy.value).some(Boolean))
async function claimAll(){
 if(!canClaimAll.value||!data.value)return
 claimingAll.value=true
 const currentToken=token.value,currentAccount=account.ethConnectAddress
 try{
  const hash=await claimAllPoolRewards(currentToken,data.value.config.community,data.value.components)
  if(!disposed&&token.value===currentToken&&account.ethConnectAddress===currentAccount){
   notify({message:t(hash?'v13ClaimAll.success':'v13ClaimAll.empty'),type:hash?'success':'info'})
   await Promise.allSettled(poolCards.value.map(card=>card.refresh()))
  }
 }catch(e){console.warn('[V13 claim all]',e);if(!disposed){const key=poolOperationErrorKey(e);notify({title:t('v13Operation.title'),message:t(key),type:key==='v13Operation.cancelled'?'info':'error'})}}
 finally{claimingAll.value=false}
}
const burnAddress='0x000000000000000000000000000000000000dEaD' as const
const burned=ref<bigint>(),burnUnavailable=ref(false)
const burnedLabel=computed(()=>burned.value===undefined?'—':Number(formatUnits(burned.value,18)).toLocaleString(locale.value,{maximumFractionDigits:6}))
const progress=computed(()=>state.value?Math.min(100,Number(state.value.supply*10000n/CURVE_CAP)/100):0)
const stage=computed(()=>!state.value?'—':state.value.listed?t('v13Page.listed'):state.value.pending?t('v13Page.pending'):t('v13Page.curve'))
let seq=0,disposed=false
async function refresh(){
 const id=++seq;loading.value=true
 const burnRequest=props.mining?getReadOnlyClient(56).readContract({address:token.value,abi:tokenAbi as Abi,functionName:'balanceOf',args:[burnAddress]})
  .then(value=>{if(id===seq&&!disposed){burned.value=value as bigint;burnUnavailable.value=false}})
  .catch(cause=>{if(id===seq&&!disposed){burnUnavailable.value=true;console.warn('[V13 burned balance]',cause)}}):Promise.resolve()
 try{
  const [d,s]=await Promise.all([getV13Detail(token.value),readLifecycle(token.value)])
  const rewards=account.ethConnectAddress?await getReadOnlyClient(56).readContract({address:token.value,abi:tokenAbi as Abi,functionName:'pendingBuybackReward',args:[account.ethConnectAddress]}).catch(()=>undefined) as bigint|undefined:undefined
  if(id!==seq||disposed)return
  data.value=d;state.value=s;pending.value=rewards;error.value=''
 }catch(e){if(id===seq)error.value=t('v13Page.loadError')}finally{await burnRequest;if(id===seq)loading.value=false}
}
async function claim(){busy.value=true;try{const guard=walletGuard();await send(token.value,tokenAbi as Abi,'claimBuybackReward',[guard.account],0n,guard);await refresh()}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{busy.value=false}}
watch([token,()=>chain.activeChainId],()=>{burned.value=undefined;burnUnavailable.value=false})
watch([token,()=>account.ethConnectAddress,()=>chain.activeChainId],()=>{seq++;data.value=undefined;state.value=undefined;pending.value=undefined;error.value='';if(token.value&&chain.activeChainId===56)void refresh()},{immediate:true})
const timer=setInterval(()=>{if(!loading.value&&!busy.value&&token.value&&chain.activeChainId===56)void refresh()},15000)
onUnmounted(()=>{disposed=true;seq++;clearInterval(timer)})
</script>
<template>
 <div class="v13-panel" :class="{'mining-panel':mining}">
  <header><div class="panel-heading"><h2>{{ mining?t('v13Page.pools'):symbol }}</h2><span v-if="mining&&data" class="pool-count">{{ data.components.length }}</span><span v-if="mining&&state" class="stage-badge">{{ stage }}</span></div><button @click="refresh" :disabled="loading">{{ t('v13Page.refresh') }}</button></header>
  <section v-if="mining" class="burn-summary" :aria-label="t('v13Page.totalBurned')">
   <div class="burn-description"><span class="burn-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M13 3c1 5-4 6-2 10 1-1 2-2 2-4 4 3 6 6 4 9-2 4-9 4-11 0-2-4 1-7 3-9 0 3 1 3 1 3-1-4 2-5 3-9Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span><p>{{ t('v13Page.poolBurnDescription',{symbol}) }}</p></div>
   <div class="burn-total" :title="burnUnavailable?t('v13Page.loadError'):t('v13Page.burnSource')"><span>{{ t('v13Page.totalBurned') }}</span><strong :title="burned===undefined?'':formatUnits(burned,18)">{{ burnedLabel }} <small>{{ symbol }}</small></strong></div>
  </section>
  <p v-if="error" role="alert">{{ error }}</p>
  <section v-if="state && (!mining || !state.listed)" class="summary"><strong>{{ stage }}</strong><template v-if="!state.listed"><progress :value="progress" max="100"/><span>{{ progress }}% · {{ Number(formatUnits(state.supply,18)).toLocaleString() }} / 650,000,000</span></template><p v-if="state.pending||(mining&&!state.listed)" class="liquidity-note"><span v-if="state.pending">{{ t('v13Page.pendingHelp') }} </span><span v-if="mining&&!state.listed">{{ t('v13Page.unseeded') }}</span></p></section>
  <template v-if="data">
   <section v-if="!mining" class="summary">
    <h3>{{ data.config.name }} ({{ data.config.symbol }})</h3>
    <div>{{ t('v13Create.fee') }}: {{ data.config.basket_fee_bps/100 }}% · {{ t('v13Create.share') }}: {{ data.config.creator_share_bps/100 }}%</div>
    <div>{{ t('postView.price') }}: {{ formatPrice(store.currentSelectedCommunity?.price || 0) }} BNB</div>
    <div>{{ t('postView.cap') }}: {{ formatAmount(store.currentSelectedCommunity?.marketCap || 0) }} BNB</div>
    <div>{{ t('v13Page.components') }}: {{ data.components.length }}</div>
    <p>{{ data.config.retain_community_ownership?t('v13Create.ownerHelp'):t('v13Create.renounceHelp') }}</p>
    <a :href="`https://bscscan.com/address/${data.config.community}`" target="_blank" rel="noopener">{{ t('v13Page.community') }} ↗</a>
    <a v-if="state?.indexToken && state.indexToken!==zeroAddress" :href="`/bsc/baskets/${state.indexToken}`">{{ t('v13Page.index') }} ↗</a>
    <div>{{ t('v13Page.dividend') }}: {{ pending===undefined?'—':formatUnits(pending,18) }} {{ data.config.symbol }}</div>
    <button :disabled="busy||!pending" @click="claim">{{ t('v13Page.claim') }}</button>
   </section>
   <section v-if="!mining && data.buyback" class="summary"><h3>{{ t('v13Page.buyback') }}</h3>
    <div>{{ t('v13Page.buybackReserve') }}: {{ formatUnits(BigInt(data.buyback.bnb_reserve),18) }} BNB</div>
    <div>{{ t('v13Page.buybackSpent') }}: {{ formatUnits(BigInt(data.buyback.total_bnb_spent),18) }} BNB</div>
    <div>{{ t('v13Page.indexBought') }}: {{ formatUnits(BigInt(data.buyback.total_index_bought),18) }} {{ data.config.symbol }}</div>
    <p>{{ t('v13Page.indexDelay') }}</p>
   </section>
   <div v-if="mining" class="claim-all-bar"><button class="claim-all-button" :disabled="!canClaimAll" :aria-busy="claimingAll" @click="claimAll"><span v-if="claimingAll" class="claim-spinner" aria-hidden="true"/>{{ t(claimingAll?'v13ClaimAll.pending':'v13ClaimAll.button') }}</button></div>
   <div v-if="mining" class="pool-grid"><V13PoolCard ref="poolCards" :actions-disabled="claimingAll" @busy="poolBusy[leg.staking_pool]=$event" v-for="leg in data.components" :key="leg.staking_pool" :token="token" :community="data.config.community" :leg="leg" :symbol="symbol" :token-logo="store.currentSelectedCommunity?.logo" :liquidity-router="liquidityRouter" /></div>
   <section v-else class="summary"><h3>{{ t('v13Page.components') }}</h3><div v-for="leg in data.components" :key="leg.asset" class="component"><a :href="`https://bscscan.com/address/${leg.asset}`" target="_blank" rel="noopener">{{ leg.asset_symbol || `${leg.asset.slice(0,8)}…${leg.asset.slice(-6)}` }}</a><span>{{ t('v13Create.weight') }} {{ leg.target_weight/100 }}%</span><a :href="`https://bscscan.com/address/${leg.pair}`" target="_blank" rel="noopener">V2 ↗</a></div><p>{{ t('v13Page.poolsHelp') }}</p></section>
  </template>
 </div>
</template>
<style scoped>
.v13-panel{display:grid;gap:16px;padding:16px}header{display:flex;justify-content:space-between;align-items:center}h2,h3{font-weight:700}.summary{display:grid;gap:12px;padding:20px;border:1px solid var(--border-base,#ddd);border-radius:16px}.component{display:flex;gap:16px;justify-content:space-between}.pool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:18px;align-items:start}p{font-size:13px;color:var(--text-muted,#777)}progress{width:100%;accent-color:#7657ed}button{border:1px solid var(--border-base,#ddd);padding:8px 12px;border-radius:8px}button:disabled{opacity:.4}[role=alert]{color:#d66a00}

.v13-panel{container-type:inline-size;min-width:0}.mining-panel{padding:20px 4px}.panel-heading{display:flex;align-items:center;gap:10px}.panel-heading h2{font-size:17px}.pool-count{display:grid;place-items:center;min-width:23px;height:23px;border:1px solid var(--border-base);border-radius:7px;font-size:11px;color:var(--text-muted)}.stage-badge{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)}.stage-badge:before{content:'';width:5px;height:5px;border-radius:50%;background:#58b79b}.mining-panel>header{padding:0 3px 5px}.mining-panel>header>button{font-size:11px;border-radius:9px;padding:7px 12px;color:var(--text-muted)}

.claim-all-bar{display:flex;justify-content:flex-end}.claim-all-button{display:flex;align-items:center;gap:7px;background:linear-gradient(110deg,#ff983c,#f68024);color:#27170b;font-size:13px;font-weight:700;border:0;padding:9px 18px;border-radius:10px}.claim-all-button:not(:disabled):hover{filter:brightness(1.08)}.claim-spinner{width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:claim-spin .8s linear infinite}@keyframes claim-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.claim-spinner{animation:none}}
.liquidity-note{padding-top:8px;border-top:1px solid var(--border-base);color:#ed6464;font-size:11px;line-height:1.5}
.burn-summary{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 18px;border:1px solid #fe913f30;border-radius:14px;background:linear-gradient(110deg,#fe913f0c,var(--surface))}.burn-description{display:flex;align-items:center;gap:12px;min-width:0}.burn-description p{font-size:12px;line-height:1.7;margin:0}.burn-icon{display:grid;place-items:center;flex-shrink:0;width:34px;height:34px;border-radius:10px;background:#fe913f12;color:#fe913f}.burn-icon svg{width:23px;height:23px}.burn-total{display:grid;gap:5px;min-width:0;text-align:right;flex-shrink:0}.burn-total>span{font-size:11px;color:var(--text-muted)}.burn-total strong{font-size:20px;line-height:1.3;color:#fe913f;font-weight:750;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.burn-total small{font-size:12px;font-weight:500}@container(max-width:560px){.burn-summary{flex-direction:column;align-items:stretch;gap:12px;padding:14px}.burn-total{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #fe913f20;padding-top:12px;flex-shrink:1}.burn-total strong{font-size:18px}}
</style>
