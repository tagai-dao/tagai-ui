<script setup lang="ts">
import {ref,onMounted,onUnmounted} from 'vue'
import {useAccountStore} from '@/stores/web3'
import {useCommunityStore} from '@/stores/community'
import {useModalStore} from '@/stores/common'
import {GlobalModalType} from '@/types'
import {initializeProvider,getReadOnlyClient,getProviderInfo} from './wallet'
const account=useAccountStore(),open=ref(true),busy=ref(false),error=ref(''),status=ref<any>(),seconds=ref(3600),blocks=ref(1)
const api='http://127.0.0.1:19900',walletName=ref('未检测到钱包')
let refreshing=false
async function refresh(){
 if(refreshing)return
 refreshing=true
 try{
 walletName.value=getProviderInfo()?.name||'未检测到钱包'
 const r=await fetch(api+'/__fork/status',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('本地链暂时无响应，请勿重复提交交易；可重启服务从最近快照恢复。');status.value=await r.json()
 const epoch=String(status.value.epoch),previous=sessionStorage.getItem('fork-epoch')
 if(previous&&previous!==epoch){localStorage.clear();sessionStorage.setItem('fork-epoch',epoch);location.assign('/bsc');return}
 sessionStorage.setItem('fork-epoch',epoch)
 if(account.ethConnectAddress)account.ethBalance=Number(await getReadOnlyClient().getBalance({address:account.ethConnectAddress as `0x${string}`}))/1e18
 const current=useCommunityStore().currentSelectedCommunity,c=status.value.communities.find((x:any)=>x.token===current?.token)
 if(c&&current)Object.assign(current,c)
 }catch(e:any){if(e.name==='TimeoutError')throw new Error('本地链响应超时，请勿重复提交交易；可重启服务从最近快照恢复。');throw e}
 finally{refreshing=false}
}
async function run(fn:()=>Promise<unknown>){if(busy.value)return;busy.value=true;error.value='';try{await fn();await refresh()}catch(e:any){error.value=e.shortMessage||e.message}finally{busy.value=false}}
async function action(name:string,body:object={}){const r=await fetch(api+'/__fork/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error);return d}
function create(){useModalStore().setModalVisible(true,GlobalModalType.CreateCoin);open.value=false}
let timer:ReturnType<typeof setInterval>
onMounted(()=>{refresh().catch(e=>error.value=e.message);timer=setInterval(()=>{if(!busy.value)refresh().catch(e=>error.value=e.message)},5000)})
onUnmounted(()=>clearInterval(timer))
</script>
<template>
 <aside class="fork-panel">
  <button class="fork-title" @click="open=!open">🧪 BSC 本地 Fork · 560013 {{open?'收起':'管理'}}</button>
  <div v-if="open" class="fork-content">
   <p>这是正式页面的本地测试模式。主网 API / 索引 / server 不参与。</p>
   <p v-if="status">来源区块 {{status.forkBlock}} · 当前 {{status.block}}<br>{{new Date(status.timestamp*1000).toLocaleString()}}</p>
   <p v-if="status?.checkpointAt">最近保存：{{new Date(status.checkpointAt).toLocaleTimeString()}} · 空闲时每 30 秒保存</p>
   <button :disabled="busy" @click="run(()=>action('checkpoint'))">保存链与社区快照</button>
   <p>{{account.ethConnectAddress||'未连接浏览器钱包'}}<br>余额 {{account.ethBalance.toFixed(4)}} 测试 BNB</p>
   <p>连接钱包：{{walletName}} · RPC：localhost:18545</p>
   <div class="fork-buttons"><button :disabled="busy" @click="run(initializeProvider)">连接 / 添加本地链</button><button :disabled="busy||!account.ethConnectAddress" @click="run(()=>action('fund',{address:account.ethConnectAddress}))">补到 1000 BNB</button><button :disabled="busy||!account.ethConnectAddress" @click="create">创建代币（原页面）</button></div>
   <hr><div class="fork-buttons"><button :disabled="busy" @click="run(()=>action('keeper'))">Keeper 执行一次</button><button :disabled="busy" @click="run(()=>action('auto',{enabled:!status?.autoKeeper}))">自动 Keeper：{{status?.autoKeeper?'开':'关'}}</button></div>
   <p>默认手动，便于观察 pendinglist；自动模式每 5 秒检查。</p>
   <p v-if="status?.autoKeeper && status?.communities?.some((c:any)=>c.listingPending&&!c.listed)" role="status">有代币等待自动上市。首次在 fork 中执行需读取主网池子状态，可能耗时数分钟；上市后还会预加载交易池数据，请勿重复点击 List。</p>
   <label>快进秒数 <input v-model.number="seconds" type="number" min="0"></label><label>新增区块 <input v-model.number="blocks" type="number" min="1" max="10000"></label>
   <button :disabled="busy" @click="run(()=>action('mine',{seconds,blocks}))">快进并出块</button>
   <hr><strong>本地社区</strong>
   <div v-for="c in status?.communities||[]" :key="c.token" class="fork-community"><a :href="`/bsc/tag-detail/${encodeURIComponent(c.tick)}`">{{c.tick}}</a><span>{{c.listed?'外盘':c.listingPending?'pendinglist':'内盘'}}</span><button :disabled="busy||!c.listingPending" @click="run(()=>action('keeper',{token:c.token}))">List</button><button :disabled="busy" @click="run(()=>action('delete',{token:c.token}))">移除记录</button></div>
   <p v-if="!status?.communities?.length">在原创建弹窗中完成创建后会出现在这里。</p>
   <details><summary>清理与重置</summary><p>移除记录 / 清空数据不会撤销链上交易。重置会恢复本次启动时的链与社区状态；如需全新主网 fork，停止服务后运行 npm run dev:fork -- --fresh。重建或恢复较早快照后，钱包若缓存旧 nonce，需要清除本地链活动记录。</p><button :disabled="busy" @click="run(()=>action('clear'))">清空临时数据</button><button :disabled="busy" @click="run(()=>action('reset'))">重置 Fork + 数据</button></details>
   <p v-if="error" class="fork-error">{{error}}</p>
   <details v-if="status?.keeperLog?.length"><summary>Keeper 结果</summary><p v-for="(l,i) in status.keeperLog" :key="i">{{l.tick}}：{{l.ok?'成功 '+l.hash:l.error}}</p></details>
  </div>
 </aside>
</template>
<style scoped>
.fork-panel{position:fixed;bottom:16px;left:16px;z-index:2500;width:min(420px,calc(100vw - 32px));font:13px/1.5 system-ui;color:#1c1917;background:#fff7ed;border:2px solid #fb923c;border-radius:12px;box-shadow:0 8px 30px #0003}.fork-title{width:100%;text-align:left;font-weight:700;background:#fed7aa!important;padding:10px!important}.fork-content{padding:12px;max-height:72vh;overflow:auto;overflow-wrap:anywhere}.fork-content p{margin:8px 0}.fork-buttons{display:flex;gap:6px;flex-wrap:wrap}.fork-panel button{padding:5px 8px;margin:3px 0;border:1px solid #ea580c;border-radius:6px;background:white;color:#1c1917;cursor:pointer}.fork-panel button:disabled{opacity:.45}.fork-panel input{width:90px;margin:5px;background:white;border:1px solid #aaa;border-radius:4px}.fork-community{display:flex;gap:8px;align-items:center;padding:5px 0}.fork-community a{font-weight:bold;text-decoration:underline}.fork-error{color:#b91c1c}.fork-panel hr{margin:12px 0;border-color:#fed7aa}
</style>
