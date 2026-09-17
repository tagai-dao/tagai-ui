import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { resolve } from 'node:path'

// Execute the real React click handlers with an inert SDK; never authenticate.
const built = await build({
  stdin: { contents: `export {default as OAuth} from './src/react_app/LoginWithOAuth.jsx';
    export {default as Email} from './src/react_app/LoginWithEmail.jsx';
    export * from './src/utils/blinkLoginReturn.ts';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  plugins: [{ name: 'login-fixtures', setup(build) {
    const fixtures = {
      react: `export const useState = value => [value === 'email' && globalThis.emailStep ? globalThis.emailStep : value, () => {}];
        export const useRef = value => ({current:value});
        export const useCallback = fn => fn; export const useMemo = fn => fn();
        export const useEffect = () => {};`,
      'react/jsx-runtime': `export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;`,
      '@privy-io/react-auth': `export const useLoginWithOAuth = () => ({state:{status:'initial'},
        initOAuth: async () => {globalThis.calls.push('oauth')}});
        export const useLoginWithEmail = () => ({state:{}, sendCode:async()=>{globalThis.calls.push('email-code')},
          loginWithCode:async()=>{globalThis.calls.push('email-login')}});
        export const usePrivy = () => ({logout:async()=>{}, getAccessToken:async()=>null});`,
      '@capacitor/core': `export const Capacitor = {getPlatform:()=> 'web'}; export const registerPlugin = () => ({});`,
      '@capacitor/app': `export const App = {};`,
      '@/utils/native.ts': `export const runNativeBrowserOAuth = start => start();`,
      '@/utils/emitter.ts': `export default {emit:(...args)=>globalThis.calls.push(args)};`,
      '../apis/api.ts': `export const privyEmailLogin = async () => ({});`,
      'lodash.debounce': `export default fn => fn;`,
    }
    build.onResolve({filter: /^@\/utils\/blinkLoginReturn\.ts$/}, () => ({path:resolve('src/utils/blinkLoginReturn.ts')}))
    build.onResolve({filter: /.*/}, args => Object.hasOwn(fixtures,args.path) ? {path:args.path,namespace:'fixture'} : undefined)
    build.onLoad({filter: /.*/,namespace:'fixture'}, args => ({contents:fixtures[args.path],loader:'js'}))
  }}],
})
const { OAuth, Email, saveBlinkLoginReturn, takeBlinkLoginReturn } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
function storage() {
  const values = new Map()
  return {getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)}
}
function reset() {
  globalThis.window = {sessionStorage:storage(),localStorage:storage()}
  globalThis.calls = []
  globalThis.emailStep = 'email'
  saveBlinkLoginReturn('/bsc/commerce/cancelled')
}
function buttons(tree) {
  if (Array.isArray(tree)) return tree.flatMap(buttons)
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === 'button' ? [tree] : []), ...buttons(tree.props?.children)]
}
reset()
await OAuth({}).props.onClick()
assert.deepEqual(calls,['oauth'])
assert.equal(takeBlinkLoginReturn(),null,'ordinary X login must not return to cancelled Blinks')

reset()
await OAuth({returnPath:'/rh/commerce/new-blink'}).props.onClick()
assert.deepEqual(calls,['oauth'])
assert.equal(takeBlinkLoginReturn(),'/rh/commerce/new-blink')

reset()
OAuth({}) // Mounting after Android OAuth return is NOT a new login attempt.
Email()
assert.equal(takeBlinkLoginReturn(),'/bsc/commerce/cancelled','remount must preserve the active return path')

reset()
const emailButtons = buttons(Email())
await emailButtons[0].props.onClick()
assert.ok(calls.includes('email-code'))
assert.equal(takeBlinkLoginReturn(),null,'email code request clears cancelled Blinks')

reset()
globalThis.emailStep = 'code'
const codeButton = buttons(Email()).find(button => String(button.props.onClick).includes('loginWithCode'))
assert.ok(codeButton,'code submission handler must be present')
await codeButton.props.onClick()
assert.ok(calls.includes('email-login'))
assert.equal(takeBlinkLoginReturn(),null,'using an earlier OTP clears a later cancelled Blinks attempt')
console.log('Blinks login isolation: ordinary X, email code request/submission, replacement and OAuth remount passed')
