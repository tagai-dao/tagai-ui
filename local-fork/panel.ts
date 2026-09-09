import {createApp,type App} from 'vue'
import Panel from './Panel.vue'
export function mountPanel(parent:App){
 const node=document.createElement('div');document.body.append(node)
 const app=createApp(Panel);app._context.provides=parent._context.provides;app.mount(node)
}
