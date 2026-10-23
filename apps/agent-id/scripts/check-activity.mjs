import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const m=JSON.parse(await fs.readFile('public/activity/manifest.json','utf8'));
const agents=JSON.parse(await fs.readFile('public/activity/agents.json','utf8'));
assert.equal(m.chainId,56);assert.equal(m.tokens.length,4);
assert.equal(m.tokens.find(t=>t.symbol==='Flaip').address,'0xb8fb293b3e8e3c5fd741e34ac5810dd5dc9f2c7f');
assert.equal(new Set(agents.map(a=>a.name)).size,agents.length);
assert.equal(new Set(agents.map(a=>a.owner)).size,agents.length);
const records=[];
for(const file of await fs.readdir('public/activity/wallets')){
 const wallets=JSON.parse(await fs.readFile('public/activity/wallets/'+file,'utf8'));
 for(const [owner,rows] of Object.entries(wallets)){assert.equal(file.slice(0,2),owner.slice(2,4));for(const r of rows){assert.equal(r.owner,owner);assert.ok(r.block<=m.snapshotBlock);assert.match(r.tx,/^0x[0-9a-f]{64}$/);assert.ok(Number(r.amount)>0);assert.ok(['inner','outer','mint'].includes(r.venue));if(r.kind==='nft')assert.equal(r.venue,'mint');if(r.asset==='Flaip')assert.equal(r.quoteSymbol,'BNCB');records.push(r);}}
}
assert.equal(new Set(records.map(r=>r.id)).size,records.length);
const nfts=records.filter(r=>r.kind==='nft'),trades=records.filter(r=>r.kind==='token');
assert.equal(nfts.reduce((n,r)=>n+Number(r.amount),0),m.nft.agentMinted);
assert.equal(nfts.length,m.nft.agentMintEvents);assert.equal(trades.length,m.totals.tokenTrades);
assert.equal(agents.reduce((n,a)=>n+a.activity.nftMintCount,0),m.nft.agentMinted);
assert.equal(agents.reduce((n,a)=>n+a.activity.tokenTrades,0),trades.length);
for(const a of agents){const s=a.activity;assert.equal(s.innerTrades+s.outerTrades,s.tokenTrades);for(const t of s.tokens){assert.equal(t.innerBuys+t.innerSells,t.inner);assert.equal(t.outerBuys+t.outerSells,t.outer);assert.equal(t.buys+t.sells,t.inner+t.outer);}}
for(const t of m.tokens){const rs=trades.filter(r=>r.asset===t.symbol);assert.equal(rs.filter(r=>r.venue==='inner').length,t.internal.agentEvents);assert.equal(rs.filter(r=>r.venue==='outer').length,t.external.agentEvents);}
const known=records.find(r=>r.tx==='0x1894f242f98f3e1a4d3b54afaa428d788dfefb045abf74e52421acff770e3ef1');
assert.ok(known);assert.equal(known.asset,'AIPRO');assert.equal(known.direction,'buy');assert.equal(known.venue,'inner');assert.equal(known.quoteAmount,'0.17');
assert.equal(m.nft.publicMinted,95000);assert.equal(m.nft.mintEvents,39214);
console.log(`Activity checks passed: ${agents.length} identities; ${trades.length} token events; ${nfts.length} mint events / ${m.nft.agentMinted} NFTs.`);
