import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {resolveAgent} from './chain.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const readJson=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const [agents,evidence,research]=await Promise.all(['registry','evidence','research'].map(n=>readJson('src/data/'+n+'.json')));
const staticRoot=resolve(root,process.env.STATIC_DIR||'dist');
const limits=new Map();let resolving=0;let snapshot=null,pendingSnapshot=null,snapshotUntil=0;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
function json(res,status,data,headers={}){res.writeHead(status,{'content-type':mime['.json'],'cache-control':'no-store',...headers});res.end(JSON.stringify(data));}
function limited(req){const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);const address=req.socket.remoteAddress;const trusted=process.env.TRUST_PROXY==='true'||address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';const key=trusted?String(req.headers['x-real-ip']||address):address;const row=limits.get(key)||{until:now+60000,count:0};if(limits.size>=4096&&!limits.has(key))return true;row.count++;limits.set(key,row);return row.count>30;}
async function fetchSnapshot(){if(snapshot&&Date.now()<snapshotUntil)return snapshot;if(pendingSnapshot)return pendingSnapshot;pendingSnapshot=(async()=>{const r=await fetch('https://bnb.fan/api/agent-id/snapshot',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const text=await r.text();if(text.length>1500000)throw Error();const x=JSON.parse(text);if(!Number.isFinite(x.total))throw Error();snapshot={total:x.total,rate1m:x.rate1m,indexedTo:x.indexedTo,head:x.head,source:'bnb.fan',checkedAt:new Date().toISOString()};snapshotUntil=Date.now()+30000;return snapshot;})().finally(()=>{pendingSnapshot=null;});return pendingSnapshot;}
export function createApp(){return createServer(async(req,res)=>{
 res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','strict-origin-when-cross-origin');res.setHeader('x-frame-options','SAMEORIGIN');
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return json(res,400,{error:'无效请求'});}
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'公开只读版本；新增线索须通过仓库审核更新'},{Allow:'GET, HEAD'});
 try{
  if(pathname==='/healthz')return json(res,200,{ok:true,service:'tagai-agent-id-atlas',readOnly:true});
  if(pathname==='/api/directory')return json(res,200,{agents,evidence,research,storageAvailable:false,dataAsOf:'2026-10-23',limitations:research.limitReason});
  if(pathname==='/api/snapshot'){try{return json(res,200,await fetchSnapshot());}catch{return json(res,502,{error:'参考站注册统计暂不可用',source:'bnb.fan'});}}
  if(pathname==='/api/resolve'){
   if(limited(req)||resolving>=16)return json(res,429,{error:'查询较多，请稍后重试'},{'Retry-After':'60'});
   const q=new URL(req.url,'http://localhost').searchParams.get('q')||'';if(q.length>80)return json(res,400,{error:'查询参数过长'});
   resolving++;try{return json(res,200,{agent:await resolveAgent(q)});}catch(e){return json(res,400,{error:e.message});}finally{resolving--;}
  }
  if(pathname.startsWith('/api/'))return json(res,404,{error:'接口不存在'});
  const file=resolve(staticRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(staticRoot+sep))return json(res,403,{error:'路径不允许'});
  const info=await stat(file);if(!info.isFile())return json(res,404,{error:'文件不存在'});
  const etag='W/"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs).toString(16)+'"';const contentType=mime[extname(file)]||'application/octet-stream';
  res.setHeader('content-type',contentType);res.setHeader('cache-control',pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':pathname.endsWith('.html')||pathname==='/'?'no-cache':'public, max-age=300');res.setHeader('etag',etag);res.setHeader('vary','Accept-Encoding');
  if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
  if(req.method==='HEAD'){res.writeHead(200);return res.end();}
  const gzip=info.size>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')&&/text|json|svg|javascript/.test(contentType);if(gzip)res.setHeader('content-encoding','gzip');res.writeHead(200);
  if(gzip)await pipeline(createReadStream(file),createGzip(),res);else await pipeline(createReadStream(file),res);
 }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'文件不存在':'请求失败，请稍后重试'});else res.destroy();}
 });}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 await stat(resolve(staticRoot,'index.html'));
 const server=createApp();server.headersTimeout=15000;server.requestTimeout=20000;server.listen(Number(process.env.PORT||8790),process.env.HOST||'127.0.0.1',()=>console.log('Agent ID ATLAS listening on port '+(process.env.PORT||8790)));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
