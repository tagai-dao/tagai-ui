import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parse, compileScript } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const { createPinia, setActivePinia } = require('pinia');
const dir = await mkdtemp(join(tmpdir(), 'privy-logout-'));
await build({
  stdin: { contents: `export * from './src/stores/privy'; export * from './src/stores/web3';
    export {default as AuthLoading} from './src/react_app/AuthLoading.jsx';
    export {default as emitter} from './src/utils/emitter';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: join(dir, 'test.cjs'),
  plugins: [{ name: 'logout-fixtures', setup(b) {
    const fixtures = {
      '@/utils/privy': 'export const customBsc = {id:56}; export const getChainById = id => ({id});',
      '@/config/chains': 'export const getChainDeployment = id => ({chainId:id});',
      './chain': 'export const useChainStore = () => ({activeChainId:56});',
      viem: `export const custom = provider => provider;
        export const createWalletClient = ({transport}) => ({getAddresses:()=>transport.request({method:'eth_accounts'})});`,
      react: `export const useRef = value => globalThis.logoutFixture.hooks.ref(value);
        export const useState = value => globalThis.logoutFixture.hooks.state(value);
        export const useEffect = (fn,deps) => globalThis.logoutFixture.hooks.effect(fn,deps);
        export const useLayoutEffect = useEffect;`,
      'react/jsx-runtime': 'export const jsx = () => null; export const Fragment = null;',
      '@privy-io/react-auth': `export const usePrivy = () => globalThis.logoutFixture.sdk;
        export const useWallets = () => ({ready:true,wallets:globalThis.logoutFixture.wallets});
        export const useCreateWallet = () => ({createWallet:async()=>{throw Error('Unexpected creation')}});
        export const useLoginWithOAuth = () => ({state:{status:'initial'}});
        export const useOAuthTokens = options => {globalThis.logoutFixture.oauth=options.onOAuthTokenGrant;return {};};`,
      '../apis/api.ts': `export const privyLogin = (...args) => globalThis.logoutFixture.login(...args);
        export const bondEthByPrivyAccToken = async () => {};`,
      '@/apis/api.ts': 'export {bondEthByPrivyAccToken} from "../apis/api.ts";',
    };
    b.onResolve({ filter: /^(vue|pinia)$/ }, a => ({ path: require.resolve(a.path), external: true }));
    b.onResolve({ filter: /.*/ }, a => Object.hasOwn(fixtures, a.path) ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: fixtures[a.path], loader: 'js' }));
    b.onResolve({ filter: /^@\// }, a => ({ path: resolve(a.path.replace('@/', 'src/') + (a.path.endsWith('.ts') ? '' : '.ts')) }));
  } }],
});
const { usePrivyStore, useAccountStore, EthWalletState, AuthLoading, emitter } = require(join(dir, 'test.cjs'));
const account = { twitterId: 'person@example.test', accountType: 1, walletType: 1, ethAddr: '0x123' };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const storage = new Map([['accountInfo', JSON.stringify(account)], ['lastLoginTime', '123']]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  setActivePinia(createPinia());
  const acc = useAccountStore(), privy = usePrivyStore();
  acc.ethWalletType = 'privy'; acc.ethConnectAddress = account.ethAddr; acc.ethConnectState = EthWalletState.Connected;
  return { acc, privy, storage };
}
test('a restored email account is reactive and cannot survive clearing or a fresh store', () => {
  const { acc, storage } = setup();
  assert.equal(acc.getAccountInfo.twitterId, account.twitterId);
  assert.equal(acc.getWalletType, 'privy');
  acc.clear();
  assert.equal(acc.getAccountInfo, null);
  assert.equal(acc.getWalletType, 'none');
  assert.equal(storage.has('accountInfo'), false);
  setActivePinia(createPinia());
  assert.equal(useAccountStore().getAccountInfo, null);
});
test('background auth cleanup preserves an anonymous external wallet but clears a lingering Privy wallet', () => {
  const { acc } = setup();
  acc.setAccount(null);
  acc.ethWalletType = 'metamask';
  acc.clear();
  assert.equal(acc.ethConnectAddress, account.ethAddr);
  assert.equal(acc.ethConnectState, EthWalletState.Connected);
  acc.ethWalletType = 'privy';
  acc.clear();
  assert.equal(acc.ethConnectAddress, '');
  assert.equal(acc.ethConnectState, EthWalletState.Disconnect);
});
test('logout waits for the SDK, deduplicates taps, then clears session and wallet', async () => {
  const { acc, privy, storage } = setup(), done = deferred();
  let calls = 0;
  privy.registerLogout(() => { calls++; return done.promise; });
  privy.ethersProvider = { request: async () => [account.ethAddr] };
  const version = acc.sessionVersion;
  const first = privy.signOut(), second = privy.signOut();
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(acc.loggingOut, true);
  assert.equal(acc.isSessionCurrent(version), false);
  assert.equal(acc.getAccountInfo.twitterId, account.twitterId);
  done.resolve(); await Promise.all([first, second]);
  assert.equal(acc.loggingOut, false);
  assert.equal(acc.getAccountInfo, null);
  assert.equal(privy.ethersProvider, null);
  assert.equal(privy.viemWalletClient, null);
  assert.equal(acc.ethConnectAddress, '');
  assert.equal(acc.ethConnectState, EthWalletState.Disconnect);
  assert.equal(storage.has('lastLoginTime'), false);
});
test('SDK failure is visible and a subsequent tap can retry, including synchronous errors', async () => {
  const { acc, privy } = setup();
  privy.registerLogout(() => { throw Error('SDK failure'); });
  await assert.rejects(privy.signOut(), /SDK failure/);
  assert.equal(acc.loggingOut, false);
  assert.equal(acc.getAccountInfo.twitterId, account.twitterId);
  privy.registerLogout(async () => {});
  await privy.signOut();
  assert.equal(acc.getAccountInfo, null);
});
test('missing SDK does not report success or clear the account', async () => {
  const { acc, privy } = setup();
  await assert.rejects(privy.signOut(), /not ready/);
  assert.equal(acc.getAccountInfo.twitterId, account.twitterId);
  assert.equal(acc.loggingOut, false);
});
test('an older provider initialization cannot reconnect after logout', async () => {
  const { acc, privy } = setup(), addresses = deferred();
  privy.ethersProvider = { request: () => addresses.promise };
  const init = privy.initWallet();
  privy.registerLogout(async () => {});
  await privy.signOut();
  addresses.resolve([account.ethAddr]); await init;
  assert.equal(acc.ethConnectAddress, '');
  assert.equal(acc.ethWalletType, 'none');
  assert.equal(privy.viemWalletClient, null);
});

// Execute the persistent React coordinator's real effects with deferred SDK work.
function coordinator(wallets = []) {
  const state = setup(), slots = [], effects = [];
  let cursor = 0;
  globalThis.logoutFixture = {
    wallets, sdk: { ready: true, logout: async () => {}, getAccessToken: async () => 'token' },
    hooks: {
      ref(value) { const i = cursor++; return slots[i] ??= { current: value }; },
      state(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => {
        slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
      }]; },
      effect(fn, deps) {
        const i = cursor++, old = slots[i];
        if (!old || deps.some((dep, n) => dep !== old.deps[n])) effects.push(() => {
          old?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
        });
      },
    },
  };
  const render = () => { cursor = 0; AuthLoading(); while (effects.length) effects.shift()(); };
  render();
  return { ...state, render, cleanup() { for (const slot of slots) slot?.cleanup?.(); emitter.all.clear(); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('persistent SDK bridge prevents a late restored provider from undoing logout', async () => {
  const provider = deferred();
  const f = coordinator([{ type: 'ethereum', walletClientType: 'privy', address: account.ethAddr,
    getEthereumProvider: () => provider.promise }]);
  try {
    await f.privy.signOut();
    provider.resolve({ request: async () => [account.ethAddr] }); await flush();
    assert.equal(f.privy.ethersProvider, null);
    assert.equal(f.acc.getAccountInfo, null);
  } finally { f.cleanup(); }
});
test('pending embedded wallet binding cannot recreate an account after logout', async () => {
  const provider = deferred();
  const f = coordinator([{ type: 'ethereum', walletClientType: 'privy', address: account.ethAddr,
    getEthereumProvider: () => provider.promise }]);
  try {
    emitter.emit('privyWalletBindingRequested', { identity: account.twitterId, accountType: 1, userInfo: account });
    f.render(); await flush();
    await f.privy.signOut();
    provider.resolve({ request: async () => [account.ethAddr] }); await flush();
    assert.equal(f.acc.getAccountInfo, null);
    assert.equal(f.privy.ethersProvider, null);
  } finally { f.cleanup(); }
});
test('late OAuth backend response cannot publish authSuccess after logout', async () => {
  const f = coordinator(), response = deferred(), successes = [];
  try {
    logoutFixture.login = () => response.promise;
    emitter.on('authSuccess', value => successes.push(value));
    const login = logoutFixture.oauth({ oAuthTokens: { accessToken: 'a', refreshToken: 'b' } });
    await flush(); await f.privy.signOut(); response.resolve(account); await login;
    assert.deepEqual(successes, []);
    assert.equal(f.acc.getAccountInfo, null);
  } finally { f.cleanup(); }
});
test('a new email login after logout can initialize its embedded wallet again', async () => {
  const f = coordinator();
  try {
    await f.privy.signOut();
    f.acc.setAccount(account);
    logoutFixture.wallets = [{ type: 'ethereum', walletClientType: 'privy', address: account.ethAddr,
      getEthereumProvider: async () => ({ request: async () => [account.ethAddr] }) }];
    emitter.emit('privyWalletBindingRequested', { identity: account.twitterId, accountType: 1, userInfo: account });
    f.render(); await flush();
    assert.equal(f.acc.ethConnectState, EthWalletState.Connected);
    assert.equal(f.acc.ethConnectAddress, account.ethAddr);
    assert.equal(f.acc.getAccountInfo.twitterId, account.twitterId);
  } finally { f.cleanup(); }
});
test('both Vue logout controls await the shared sign-out before navigation', async () => {
  for (const path of ['src/views/profile/ProfileView.vue', 'src/components/common/PrivyModal.vue']) {
    const source = await readFile(path, 'utf8');
    assert.ok(compileScript(parse(source).descriptor, { id: 'logout-regression' }).content);
    assert.match(source, /await (?:privyStore|usePrivyStore\(\))\.signOut\(\);[\s\S]*?await router\.replace/);
    assert.match(source, /:disabled="accStore.loggingOut"/);
    assert.doesNotMatch(source, /ReactLogoutOAuth|logout\(\);\$router/);
    if (path.includes('ProfileView')) assert.match(source, /v-if="accStore.getAccountInfo"/);
  }
});
after(async () => { delete globalThis.logoutFixture; await rm(dir, { recursive: true, force: true }); });
