type Detail = {provider:any;info:{name:string;uuid:string;rdns?:string;icon:string}}
// Keep discovery separate from window.ethereum, which other extensions can replace.
export function discoverWallets(host:Window & {ethereum?:any}){
 const announced:Detail[]=[]
 host.addEventListener('eip6963:announceProvider',((event:CustomEvent<Detail>)=>{
  const d=event.detail
  if(d?.provider?.request&&d.info?.uuid&&!announced.some(x=>x.provider===d.provider))announced.push(d)
 }) as EventListener)
 const request=()=>host.dispatchEvent(new Event('eip6963:requestProvider'))
 const list=()=>{
  const legacy=host.ethereum?.providers||[host.ethereum]
  return [...announced,...legacy.filter((p:any)=>p?.request&&!announced.some(d=>d.provider===p)).map((p:any,i:number)=>({provider:p,info:{uuid:'legacy-'+i,icon:'',name:p.isOkxWallet||p.isOKExWallet?'OKX':p.isRabby?'Rabby':p.isMetaMask?'MetaMask (legacy)':'Browser wallet'}}))] as Detail[]
 }
 const preferred=()=>list().find(d=>d.info.rdns==='io.metamask')||list().find(d=>d.info.name==='MetaMask (legacy)')||list()[0]
 request()
 return {request,list,preferred}
}
