<script setup lang="ts">
import {getChainDeployment} from '@/config/chains'
import {ref,computed,watch,onUnmounted} from 'vue'
import {useI18n} from 'vue-i18n'
import {type Address,type Abi,formatUnits,zeroAddress} from 'viem'
import {useCommunityStore} from '@/stores/community'
import {useAccountStore} from '@/stores/web3'
import {formatPrice,formatAmount} from '@/utils/helper'
import {useChainStore} from '@/stores/chain'
import {getV13Detail,send,walletGuard,type V13Detail} from '@/utils/v13/pools'
import {readLifecycle,CURVE_CAP} from '@/utils/v13/lifecycle'
import {getReadOnlyClient} from '@/utils/wallets'
import tokenAbi from '@/utils/v13/Token13.json'
import V13PoolCard from './V13PoolCard.vue'
const liquidityRouter=getChainDeployment(56).contracts.liquidityRouter13??null
const props=defineProps<{mining?:boolean}>()
const {t}=useI18n(),store=useCommunityStore(),account=useAccountStore(),chain=useChainStore()
const token=computed(()=>store.currentSelectedCommunity?.token as Address),symbol=computed(()=>store.currentSelectedCommunity?.tick||'Token')
const data=ref<V13Detail>(),state=ref<Awaited<ReturnType<typeof readLifecycle>>>(),pending=ref<bigint>(),error=ref(''),loading=ref(false),busy=ref(false)
const progress=computed(()=>state.value?Math.min(100,Number(state.value.supply*10000n/CURVE_CAP)/100):0)
const stage=computed(()=>!state.value?'—':state.value.listed?t('v13Page.listed'):state.value.pending?t('v13Page.pending'):t('v13Page.curve'))
let seq=0,disposed=false
async function refresh(){
 const id=++seq;loading.value=true
 try{
  const [d,s]=await Promise.all([getV13Detail(token.value),readLifecycle(token.value)])
  const rewards=account.ethConnectAddress?await getReadOnlyClient(56).readContract({address:token.value,abi:tokenAbi as Abi,functionName:'pendingBuybackReward',args:[account.ethConnectAddress]}).catch(()=>undefined) as bigint|undefined:undefined
  if(id!==seq||disposed)return
  data.value=d;state.value=s;pending.value=rewards;error.value=''
 }catch(e){if(id===seq){error.value=t('v13Page.loadError');state.value=undefined;pending.value=undefined}}finally{if(id===seq)loading.value=false}
}
async function claim(){busy.value=true;try{const guard=walletGuard();await send(token.value,tokenAbi as Abi,'claimBuybackReward',[guard.account],0n,guard);await refresh()}catch(e){error.value=e instanceof Error?e.message:String(e)}finally{busy.value=false}}
watch(()=>[token.value,account.ethConnectAddress,chain.activeChainId],()=>{data.value=undefined;state.value=undefined;pending.value=undefined;if(token.value&&chain.activeChainId===56)void refresh()},{immediate:true})
const timer=setInterval(()=>{if(!loading.value&&!busy.value&&token.value&&chain.activeChainId===56)void refresh()},15000)
onUnmounted(()=>{disposed=true;seq++;clearInterval(timer)})
</script>
<template>
 <div class="v13-panel">
  <header><h2>{{ mining?t('v13Page.pools'):symbol }}</h2><button @click="refresh" :disabled="loading">{{ t('v13Page.refresh') }}</button></header>
  <p v-if="error" role="alert">{{ error }}</p>
  <section v-if="state" class="summary"><strong>{{ stage }}</strong><template v-if="!state.listed"><progress :value="progress" max="100"/><span>{{ progress }}% · {{ Number(formatUnits(state.supply,18)).toLocaleString() }} / 650,000,000</span></template><p v-if="state.pending">{{ t('v13Page.pendingHelp') }}</p></section>
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
   <div v-if="mining" class="pool-grid"><V13PoolCard v-for="leg in data.components" :key="leg.staking_pool" :token="token" :community="data.config.community" :leg="leg" :symbol="symbol" :liquidity-router="liquidityRouter" /></div>
   <section v-else class="summary"><h3>{{ t('v13Page.components') }}</h3><div v-for="leg in data.components" :key="leg.asset" class="component"><a :href="`https://bscscan.com/address/${leg.asset}`" target="_blank" rel="noopener">{{ leg.asset_symbol || `${leg.asset.slice(0,8)}…${leg.asset.slice(-6)}` }}</a><span>{{ t('v13Create.weight') }} {{ leg.target_weight/100 }}%</span><a :href="`https://bscscan.com/address/${leg.pair}`" target="_blank" rel="noopener">V2 ↗</a></div><p>{{ t('v13Page.poolsHelp') }}</p></section>
  </template>
 </div>
</template>
<style scoped>
.v13-panel{display:grid;gap:16px;padding:16px}header{display:flex;justify-content:space-between;align-items:center}h2,h3{font-weight:700}.summary{display:grid;gap:12px;padding:20px;border:1px solid var(--border-base,#ddd);border-radius:16px}.component{display:flex;gap:16px;justify-content:space-between}.pool-grid{display:grid;gap:16px}p{font-size:13px;color:var(--text-muted,#777)}progress{width:100%;accent-color:#7657ed}button{border:1px solid var(--border-base,#ddd);padding:8px 12px;border-radius:8px}button:disabled{opacity:.4}[role=alert]{color:#d66a00}
</style>
