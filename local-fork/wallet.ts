import {createPublicClient,createWalletClient,custom,http,defineChain,getAddress,type Address} from 'viem'
import {useAccountStore,EthWalletState} from '@/stores/web3'
import {useChainStore} from '@/stores/chain'
import {discoverWallets} from './providers'
const rpc='http://127.0.0.1:18545'
const walletRpc='http://localhost:18545'
export const localChain=defineChain({id:560013,name:'BSC Local Fork',nativeCurrency:{name:'Test BNB',symbol:'tBNB',decimals:18},rpcUrls:{default:{http:[walletRpc]}},contracts:{multicall3:{address:'0xcA11bde05977b3631167028862bE2a173976CA11'}}})
const client=createPublicClient({chain:localChain,transport:http(rpc,{timeout:120000}),cacheTime:0})
let selected:any
const discovery=discoverWallets(window)
const raw=()=>selected||discovery.preferred()?.provider
export const getReadOnlyClient=(_chain?:number)=>client
export const clearPublicClientCache=()=>{}
export const getProvider=()=>({request:async(args:any)=>{
 const p=raw();if(!p)throw new Error('请安装浏览器钱包')
 if(['eth_sendTransaction','eth_signTransaction','eth_sendRawTransaction','eth_signTypedData_v4'].includes(args.method)){
  if(Number(await p.request({method:'eth_chainId'}))!==560013)throw new Error('请切换到本地 BSC Fork，禁止发送到主网')
 }
 return p.request(args)
}})
export const getWalletClient=()=>raw()?createWalletClient({chain:localChain,transport:custom(getProvider())}):null
export const getProviderInfo=()=>discovery.list().find(d=>d.provider===raw())?.info
export const getProviders=()=>discovery.list()
export const isMetaMaskInstalled=()=>!!raw()
export const isMetaMaskConnected=()=>!!useAccountStore().ethConnectAddress
export const isInitinalized=()=>true
export async function setup(){
 discovery.request()
 if(!discovery.list().length)await new Promise(resolve=>setTimeout(resolve,200))
 const p=raw();if(!p)throw new Error('请安装浏览器钱包')
 selected=p;listen(p)
 try{if(Number(await p.request({method:'eth_chainId'}))!==560013)await p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x88b8d'}]})}
 catch(e:any){if(e.code!==4902)throw e;try{await p.request({method:'wallet_addEthereumChain',params:[{chainId:'0x88b8d',chainName:'BSC Local Fork',rpcUrls:[walletRpc],nativeCurrency:{name:'Test BNB',symbol:'tBNB',decimals:18}}]})}catch(addError:any){if(/HTTPS url/i.test(addError.message||''))throw new Error(`${getProviderInfo()?.name||'钱包'} 拒绝自动添加本地 HTTP RPC。请在 MetaMask 设置中手动添加：BSC Local Fork，RPC ${walletRpc}，链 ID 560013，符号 tBNB，然后重新连接。`);throw addError}await p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x88b8d'}]})}
 if(Number(await p.request({method:'eth_chainId'}))!==560013)throw new Error('本地链切换失败')
 const block=await client.getBlock()
 const walletBlock=await p.request({method:'eth_getBlockByNumber',params:['0x'+block.number.toString(16),false]})
 if(walletBlock?.hash?.toLowerCase()!==block.hash?.toLowerCase())throw new Error('钱包 RPC 与本地 fork 不一致，请将该网络 RPC 设置为 '+walletRpc)
 useAccountStore().chainId=560013
}
async function bind(accounts:string[]){
 const store=useAccountStore();if(!accounts.length){store.ethConnectState=EthWalletState.Disconnect;store.ethConnectAddress='';return}
 const address=getAddress(accounts[0]);store.ethConnectAddress=address;store.ethConnectState=EthWalletState.Connected;store.ethWalletType='MetaMask';store.chainId=560013
 store.setAccount({twitterId:'fork-'+address.toLowerCase(),twitterName:'Local Tester',twitterUsername:'local_tester',profile:'http://127.0.0.1:19900/logo.svg',followers:0,followings:0,ethAddr:address,walletType:0,accessToken:'local-only',op:10000,vp:10000} as any)
 useChainStore().setActiveChain(56,{reload:false});store.ethBalance=Number(await client.getBalance({address}))/1e18
}
export async function initializeProvider(){await setup();await bind(await raw().request({method:'eth_requestAccounts'}));return true}
export const setMetaMaskSDK=initializeProvider
export const setActiveProviderDetail=async(d:any)=>{selected=d.provider;return initializeProvider()}
const listening=new WeakSet<object>()
function listen(p:any){
 if(listening.has(p))return;listening.add(p)
 p.on?.('accountsChanged',(accounts:string[])=>{if(raw()===p)void bind(accounts)});p.on?.('chainChanged',()=>{if(raw()===p)useAccountStore().ethConnectState=EthWalletState.Disconnect})
}
export async function initPlugin(){
 discovery.request()
 const p=raw();if(!p)return
 listen(p)
 const accounts=await p.request({method:'eth_accounts'});if(accounts.length&&Number(await p.request({method:'eth_chainId'}))===560013)setTimeout(()=>{if(raw()===p){selected=p;void bind(accounts)}},300)
}
export const closeProvider=()=>useAccountStore().clear()
export const signMessage=async(message:string)=>{await setup();return getWalletClient()!.signMessage({account:useAccountStore().ethConnectAddress as Address,message})}
export const getBalance=(addr:Address)=>client.getBalance({address:addr})
export const getBlockNumber=()=>client.getBlockNumber()
export const getBlock=(blockNumber:bigint)=>client.getBlock({blockNumber})
// Match src/utils/wallets.ts: callers pass the returned hash to receipt/API reads.
export const waitForTx=async(hash:`0x${string}`)=>{
 const receipt=await client.waitForTransactionReceipt({hash})
 return receipt.status==='success'?hash:null
}
export const transferEthTo=async(to:Address,value:bigint)=>{await setup();return getWalletClient()!.sendTransaction({account:useAccountStore().ethConnectAddress as Address,to,value,chain:localChain})}
