import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/index.mjs';
const server=createApp();server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;after(()=>new Promise(resolve=>server.close(resolve)));
test('public directory ships complete X evidence without Sites login',async()=>{const r=await fetch(base+'/api/directory');assert.equal(r.status,200);const d=await r.json();assert.equal(d.storageAvailable,false);assert.equal(d.evidence.length,1826);assert.ok(d.evidence.some(e=>e.name==='heyi.ai'&&e.xHandle==='heyibinance'));});
test('evidence writes cannot bypass authentication after migration',async()=>{const r=await fetch(base+'/api/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,405);});
test('unknown API never falls through to SPA HTML',async()=>{assert.equal((await fetch(base+'/api/not-real')).status,404);});
test('health endpoint and security headers',async()=>{const r=await fetch(base+'/healthz');assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal((await r.json()).readOnly,true);});
