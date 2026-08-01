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
import { isProductChain } from '@/config/chains'

const router = createRouter({
  // @ts-ignore
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:commerceid?',
      name: 'home',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'tag' }
    },
    {
      path: '/coins',
      name: 'coins',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'coin' }
    },
    {
      path: '/predictions',
      name: 'predictions',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'prediction' }
    },
    {
      path: '/commerce/:commerceid?',
      name: 'commerce',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true, mainMenu: 'tag' }
    },
    {
      path: '/tag-detail/:id/:sellsman?',
      name: 'tag-detail',
      component: HomeTagDetail,
      meta: { tabBar: true, topBar: true, keepAlive: true }
    },
    {
      path: '/buy-sell/:id/:sellsman?',
      name: 'buy-sell',
      component: BuyAndSellView
    },
    {
      path: '/space-detail/:id',
      name: 'space-detail',
      component: TweetSpaceDetail
    },
    {
      path: '/post-detail/:id',
      name: 'post-detail',
      component: TweetPostDetail
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { tabBar: true, topBar: true, gotoHome: true, keepAlive: true }
    },
    {
      path: '/user/:username',
      name: 'user',
      component: UserView,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: WalletView,
      meta: { tabBar: true, topBar: true, gotoHome: true, keepAlive: true }
    },
    {
      path: '/notification',
      name: 'notification',
      component: NotificationView
    },
    {
      path: '/login',
      name: 'login-call-back',
      component: () => import('@/views/LoginCallBack.vue')
    },
    {
      path: '/clanker/token/:token',
      name: 'clanker-token',
      component: ClankerDetail,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/tip-record',
      name: 'tip-record',
      component: TipTokenRecord
    },
    {
      path: "/callback", component: () => import("@/views/Callback.vue")
    },
    {
      path: '/predict/battle/:id',
      name: 'predict-battle',
      component: PredictDetail
    },
    {
      path: '/mindshare',
      name: 'mindshare',
      component: MindShareIndex
    },
    {
      path: '/predict/event/:id',
      name: 'predict-event',
      component: PredictEventDetail
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/baskets',
      name: 'baskets',
      component: () => import('@/views/baskets/BasketsListView.vue'),
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/baskets/:address/fees',
      name: 'basket-fees',
      component: () => import('@/views/baskets/BasketFeesView.vue'),
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/baskets/:address',
      name: 'basket-detail',
      component: () => import('@/views/baskets/BasketDetailView.vue'),
      meta: { tabBar: true, topBar: true }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  // Blink 分享链接中的链优先于浏览器记忆；先切产品链，再做路由功能判断和详情请求。
  const queryChainId = Number(Array.isArray(to.query.chainId) ? to.query.chainId[0] : to.query.chainId)
  if (isProductChain(queryChainId) && queryChainId !== useChainStore().activeChainId) {
    // 只切换页面数据链；用户发起交易时再由现有流程同步钱包网络。
    useChainStore().setActiveChain(queryChainId, { reload: false })
  }

  const predictionRoutes = new Set(['predictions', 'predict-battle', 'predict-event'])
  if (predictionRoutes.has(String(to.name)) && !useChainStore().deployment.features.prediction) {
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
