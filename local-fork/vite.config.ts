import base from '../vite.config'
import {defineConfig, mergeConfig} from 'vite'
import {resolve} from 'node:path'

// Only selected by `npm run dev:fork`. No production configuration/imports change.
export default defineConfig(async env => {
 if(env.command!=='serve')throw new Error('Local fork configuration is serve-only')
 const config=typeof base==='function'?await base(env):base
 const root=process.cwd()
 return mergeConfig(config,{
  cacheDir:'.local-fork/vite-cache',
  define:{'import.meta.env.VITE_APP_BACKEND_API_URL':JSON.stringify('http://127.0.0.1:19900')},
  server:{host:'127.0.0.1',port:15173,strictPort:true,headers:{'Content-Security-Policy':"connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*;"}},
  plugins:[{name:'local-fork-only',enforce:'pre',
   handleHotUpdate(ctx){
    // The mounted app keeps its i18n instance across component HMR. Reload when
    // dictionaries change so it cannot retain old messages or show raw keys.
    if(ctx.file.startsWith(resolve(root,'src/lang')+'/')){
     ctx.server.moduleGraph.invalidateAll()
     ctx.server.ws.send({type:'full-reload'})
     return []
    }
   },
   transform(code,id){
    const path=id.split('?')[0]
    if(path===resolve(root,'src/react_app/App.jsx'))return 'export default function LocalAuthBoundary(props){return props.children}'
    if(path===resolve(root,'src/utils/wallets.ts'))return `export * from ${JSON.stringify(resolve(root,'local-fork/wallet.ts'))}`
    if(path===resolve(root,'src/config/chains.ts'))return code+`\nBSC_CHAIN.rpc='http://127.0.0.1:18545';BSC_CHAIN.rpcUrls=[BSC_CHAIN.rpc];BSC_CHAIN.multiConfig.rpcUrl=BSC_CHAIN.rpc;BSC_CHAIN.name='BSC Local Fork';`
    if(path===resolve(root,'src/utils/privy.ts'))return code.replace('...bsc,','...bsc, id:560013, name:"BSC Local Fork",')
    if(path===resolve(root,'src/utils/web3.ts'))return code.replace('const target = getChainDeployment(useChainStore().activeChainId);','const target = {...getChainDeployment(56),chainId:560013};')
    if(path===resolve(root,'src/utils/v13/snapshot.ts'))return code.replace('[56n, m.nutboxRouter','[560013n, m.nutboxRouter')
    if(path===resolve(root,'src/utils/v13/creation-chain.ts'))return code.replace('client.chain?.id !== 56','client.chain?.id !== 560013')
    // Keep form validation and chart selection identical to production. Test
    // conveniences belong in the panel; external integrations need separate acceptance.
    if(path===resolve(root,'src/composables/useUploadImg.ts'))return code.replace('https://upload.tagai.fun/files/upload','http://127.0.0.1:19900/files/upload')
    if(path===resolve(root,'src/main.ts'))return code.replace("app.mount('#app')",`app.mount('#app');import(${JSON.stringify(resolve(root,'local-fork/panel.ts'))}).then(m=>m.mountPanel(app))`)
   }
  }]
 })
})
