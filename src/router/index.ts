import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAccountStore } from '@/stores/web3'
import { useModalStore, useStateStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import HomeTagDetail from '@/views/tag-detail/HomeTagDetail.vue'
import BuyAndSellView from '@/views/buy-sell/BuyAndSellView.vue'
import TweetSpaceDetail from '@/views/space-detail/TweetSpaceDetail.vue'
import TweetPostDetail from '@/views/post-detail/TweetPostDetail.vue'
import ProfileView from '@/views/profile/ProfileView.vue'
import WalletView from '@/views/wallet/WalletView.vue'
import NotificationView from '@/views/notification/NotificationView.vue'
import LoginCallBack from '@/views/LoginCallBack.vue'
import ClankerDetail from '@/views/clanker/ClankerDetail.vue'
import TipTokenRecord from "@/views/wallet/TipTokenRecord.vue";
import UserView from '@/views/profile/UserView.vue'
import PredictDetail from '@/views/predict-detail/Index.vue'
import PredictEventDetail from '@/views/predict-event-detail/Index.vue'
import MindShareIndex from '@/views/mind-share/Index.vue'
import AboutView from '@/views/about/AboutView.vue'
import { useChainStore } from '@/stores/chain'
import { getChainIdFromSlug, getChainPath, isProductChain } from '@/config/chains'

const chainPrefix = '/:chain(bsc|rh)?'

const router = createRouter({
  // @ts-ignore
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: `${chainPrefix}/:commerceid?`,
      name: 'home',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'tag' }
    },
    {
      path: `${chainPrefix}/coins`,
      name: 'coins',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'coin' }
    },
    {
      path: `${chainPrefix}/predictions`,
      name: 'predictions',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'prediction' }
    },
    {
      path: `${chainPrefix}/commerce/:commerceid?`,
      name: 'commerce',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'tag' }
    },
    {
      path: `${chainPrefix}/tag-detail/:id/:sellsman?`,
      name: 'tag-detail',
      component: HomeTagDetail,
      meta: { tabBar: true, topBar: true, keepAlive: true }
    },
    {
      path: `${chainPrefix}/buy-sell/:id/:sellsman?`,
      name: 'buy-sell',
      component: BuyAndSellView
    },
    {
      path: `${chainPrefix}/space-detail/:id`,
      name: 'space-detail',
      component: TweetSpaceDetail
    },
    {
      path: `${chainPrefix}/post-detail/:id`,
      name: 'post-detail',
      component: TweetPostDetail
    },
    {
      path: `${chainPrefix}/profile`,
      name: 'profile',
      component: ProfileView,
      meta: { tabBar: true, topBar: true, gotoHome: true, keepAlive: true }
    },
    {
      path: `${chainPrefix}/user/:username`,
      name: 'user',
      component: UserView,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: `${chainPrefix}/wallet`,
      name: 'wallet',
      component: WalletView,
      meta: { tabBar: true, topBar: true, gotoHome: true, keepAlive: true }
    },
    {
      path: `${chainPrefix}/notification`,
      name: 'notification',
      component: NotificationView
    },
    {
      path: `${chainPrefix}/login`,
      name: 'login-call-back',
      component: () => import('@/views/LoginCallBack.vue')
    },
    {
      path: `${chainPrefix}/clanker/token/:token`,
      name: 'clanker-token',
      component: ClankerDetail,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: `${chainPrefix}/tip-record`,
      name: 'tip-record',
      component: TipTokenRecord
    },
    {
      path: `${chainPrefix}/callback`, component: () => import("@/views/Callback.vue")
    },
    {
      path: `${chainPrefix}/predict/battle/:id`,
      name: 'predict-battle',
      component: PredictDetail
    },
    {
      path: `${chainPrefix}/mindshare`,
      name: 'mindshare',
      component: MindShareIndex
    },
    {
      path: `${chainPrefix}/predict/event/:id`,
      name: 'predict-event',
      component: PredictEventDetail
    },
    {
      path: `${chainPrefix}/about`,
      name: 'about',
      component: AboutView,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: `${chainPrefix}/baskets`,
      name: 'baskets',
      component: () => import('@/views/baskets/BasketsListView.vue'),
      meta: { tabBar: true, topBar: true }
    },
    {
      path: `${chainPrefix}/baskets/:address/fees`,
      name: 'basket-fees',
      component: () => import('@/views/baskets/BasketFeesView.vue'),
      meta: { tabBar: true, topBar: true }
    },
    {
      path: `${chainPrefix}/baskets/:address`,
      name: 'basket-detail',
      component: () => import('@/views/baskets/BasketDetailView.vue'),
      meta: { tabBar: true, topBar: true }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const chainStore = useChainStore()
  const routeChain = Array.isArray(to.params.chain) ? to.params.chain[0] : to.params.chain
  const routeChainId = getChainIdFromSlug(routeChain)
  const queryChainId = Number(Array.isArray(to.query.chainId) ? to.query.chainId[0] : to.query.chainId)

  // 兼容旧链接：URL 路径链 > ?chainId= > 浏览器记忆，并统一重定向到 /bsc 或 /rh 前缀。
  if (!routeChainId) {
    const chainId = isProductChain(queryChainId) ? queryChainId : chainStore.activeChainId
    const query = { ...to.query }
    delete query.chainId
    next({ path: getChainPath(chainId, to.path), query, hash: to.hash, replace: true })
    return
  }

  if (routeChainId !== chainStore.activeChainId) {
    // 只切换页面数据链；用户发起交易时再由现有流程同步钱包网络。
    chainStore.setActiveChain(routeChainId, { reload: false })
  }

  // 路径已经明确链时移除旧 query，避免同一个链接出现两个相互冲突的链标识。
  if ('chainId' in to.query) {
    const query = { ...to.query }
    delete query.chainId
    next({ path: to.path, query, hash: to.hash, replace: true })
    return
  }

  const predictionRoutes = new Set(['predictions', 'predict-battle', 'predict-event'])
  const predictionFeatures = chainStore.deployment.features
  const predictionUnavailable = predictionRoutes.has(String(to.name)) && !predictionFeatures.prediction
  const predictionMainUnavailable = to.name === 'predictions' && !predictionFeatures.predictionMainEntry
  if (predictionUnavailable || predictionMainUnavailable) {
    next({ path: '/' })
    return
  }
  // 隐藏 MindShare 页面：任何访问都重定向回首页
  if (to.path === '/mindshare' || to.name === 'mindshare') {
    next({ path: '/' })
    return
  }

  const account = useAccountStore().getAccountInfo
  if (to.meta.gotoHome && !account?.twitterId) {
    // 记录目标页，登录成功后回跳（App.vue 监听 login 事件处理）
    sessionStorage.setItem('login-redirect', to.fullPath)
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    next({
      path: from.fullPath
    })
    return
  }

  // 主菜单路由化：/、/coins、/predictions 共用 HomeView，由路由 meta 驱动菜单状态
  if (to.meta.mainMenu) {
    const stateStore = useStateStore()
    stateStore.setActiveMainMenu(to.meta.mainMenu as 'tag' | 'coin' | 'prediction')
    if (to.meta.mainMenu === 'coin') {
      const coinTab = to.query.tab
      stateStore.setCoinSubMenu(coinTab === 'ip' ? 'ip' : coinTab === 'bstocks' ? 'bStocks' : 'tagCoin')
    }
  }
  next();
})

export default router
