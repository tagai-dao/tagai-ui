import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { ref, reactive, watch, nextTick } from 'vue'

// Exercise the actual component logic; mock only API, timer and DOM boundaries.
const source = readFileSync('src/components/common/SearchBar.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*;?\n/gm, '')
const compiled = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
function fixture(api = async id => [{ tick: id }]) {
  const listeners = new Map(), stops = [], cleanup = [], errors = [], navigation = [], calls = []
  const route = reactive({ fullPath: '/bsc' }), chain = reactive({ activeChainId: 56 }), store = {}
  const request = (...args) => { calls.push(args); return api(...args) }
  const env = { ref, watch: (...args) => stops.push(watch(...args)),
    onMounted: fn => fn(), onUnmounted: fn => cleanup.push(fn), onDeactivated: fn => cleanup.push(fn),
    useRoute: () => route, useRouter: () => ({ push: url => navigation.push(url) }), useChainStore: () => chain,
    useCommunityStore: () => store, handleErrorTip: e => errors.push(e),
    document: { addEventListener: (type,fn) => listeners.set(type,fn), removeEventListener: type => listeners.delete(type) },
    debounce: fn => { let args; const run = (...a) => { args=a }; run.cancel=()=>{args=null}; run.flush=()=>{ const a=args; args=null; return a ? fn(...a) : undefined }; return run },
    searchCommunity: request, getTweetById: request, getTweetBySpaceId: request,
    searchMindShareByUsername: request, getTokenByTickOrCA: request,
  }
  const state = new Function(...Object.keys(env), `${compiled}; return { searchText,searchRef,showSearchList,list,tweetsList,mindShareList,onInput,runSearch,clearSearchList,dismissSearch,gotoDetail }`)(...Object.values(env))
  state.searchRef.value = {}
  return { ...state, route, chain, errors, navigation, calls, store,
    input(text) { state.searchText.value=text; state.onInput() },
    pointer(inside) { listeners.get('pointerdown')({ composedPath: () => inside ? [state.searchRef.value] : [] }) },
    dispose() { cleanup.forEach(fn=>fn()); stops.forEach(fn=>fn()) }, listeners,
  }
}

test('outside clicks dismiss, inside clicks keep results usable, and refocus can search again', async () => {
  const f=fixture();try {
    f.input('star');await f.runSearch.flush();assert.equal(f.showSearchList.value,true)
    f.pointer(true);assert.equal(f.showSearchList.value,true)
    f.pointer(false);assert.equal(f.showSearchList.value,false);assert.equal(f.searchText.value,'star')
    f.onInput();await f.runSearch.flush();assert.equal(f.showSearchList.value,true)
    const row={tick:'Starship'};f.gotoDetail(row)
    assert.equal(f.showSearchList.value,false);assert.deepEqual(f.navigation,['/tag-detail/Starship'])
    assert.equal(f.store.currentSelectedCommunity,row)
  }finally{f.dispose()}
})
test('dismiss and clear cancel a search still waiting for the debounce timer', async () => {
  for(const clear of [false,true]) {
    const f=fixture();try {
      f.input('star');if(clear)f.clearSearchList();else f.pointer(false)
      await f.runSearch.flush();assert.equal(f.calls.length,0);assert.equal(f.showSearchList.value,false)
    }finally{f.dispose()}
  }
})
test('late success or failure after outside click cannot reopen results or show stale errors', async () => {
  for(const fail of [false,true]) {
    const d=deferred(),f=fixture(()=>d.promise);try {
      f.input('star');const pending=f.runSearch.flush();f.pointer(false)
      if(fail)d.reject(Error('offline'));else d.resolve([{tick:'Starship'}]);await pending
      assert.equal(f.showSearchList.value,false);assert.deepEqual(f.list.value,[]);assert.equal(f.errors.length,0)
    }finally{f.dispose()}
  }
})
test('older search results cannot overwrite a newer query', async () => {
  const d=deferred(),f=fixture(id=>id==='star'?d.promise:[{tick:'CyberCab'}]);try {
    f.input('star');const pending=f.runSearch.flush();f.input('cyber');await f.runSearch.flush()
    d.resolve([{tick:'Starship'}]);await pending
    assert.deepEqual(f.list.value,[{tick:'CyberCab'}]);assert.equal(f.showSearchList.value,true)
  }finally{f.dispose()}
})
test('clearing or entering whitespace never searches all communities or reopens on a pending response', async () => {
  const d=deferred(),f=fixture(()=>d.promise);try {
    f.input('star');const pending=f.runSearch.flush();f.clearSearchList()
    d.resolve([{tick:'Starship'}]);await pending
    f.input('   ');await f.runSearch.flush();assert.equal(f.calls.length,1)
    assert.deepEqual(f.list.value,[]);assert.equal(f.showSearchList.value,false)
  }finally{f.dispose()}
})
test('navigation, chain changes and component disposal discard pending results', async () => {
  for(const action of ['route','chain','dispose']) {
    const d=deferred(),f=fixture(()=>d.promise);try {
      f.input('star');const pending=f.runSearch.flush()
      if(action==='route')f.route.fullPath='/bsc/feed'
      if(action==='chain')f.chain.activeChainId=4663
      if(action==='dispose')f.dispose()
      await nextTick();d.resolve([{tick:'Starship'}]);await pending
      assert.equal(f.showSearchList.value,false);assert.deepEqual(f.list.value,[])
      if(action==='dispose')assert.equal(f.listeners.size,0)
    }finally{f.dispose()}
  }
})
