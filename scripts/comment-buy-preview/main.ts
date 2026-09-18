import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { ElDialog } from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/style/main.css'
import './preview.css'
import CommentBuyAuthorization from '@/views/wallet/social/CommentBuyAuthorization.vue'
const lang = new URLSearchParams(location.search).get('lang') || 'zh'
if (new URLSearchParams(location.search).get('theme') === 'light') document.documentElement.classList.remove('dark')
const app = createApp({ render: () => h('main', { class: 'preview-shell' }, [
  h('div', { class: 'preview-label' }, 'LOCAL DESIGN PREVIEW · 模拟数据 · 不连接钱包，不发送交易'),
  h('nav', { class: 'preview-nav' }, [h('span', 'Coin'), h('span', 'IPShare'), h('span', '预测'), h('strong', 'AI Au-Pay')]),
  h('div', { class: 'preview-tabs' }, [h('strong', lang === 'en' ? 'Comment buy' : '评论买币'), h('span', lang === 'en' ? 'Social tipping' : '社交打赏'), h('small', lang === 'en' ? 'Separate funds & authorizations' : '独立账户 · 独立授权')]),
  h(CommentBuyAuthorization),
]) })
app.use(createI18n({ legacy: false, locale: lang, messages: { zh: {}, en: {} } }))
app.component('el-dialog', ElDialog)
app.mount('#app')
