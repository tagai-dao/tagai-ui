import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
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
import PredictBattle from '@/views/tag-detail/PredictBattle.vue'
import PredictDetail from '@/views/predict-detail/Index.vue'
import MindShareIndex from '@/views/mind-share/Index.vue'
import MiniAppView from '@/views/MiniApp/MiniAppView.vue'
import MiniAppsExplore from '@/views/MiniApp/MiniAppsExplore.vue'

const router = createRouter({
  // @ts-ignore
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:commerceid?',
      name: 'home',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true }
    },
    {
      path: '/commerce/:commerceid?',
      name: 'commerce',
      component: HomeView,
      meta: { tabBar: true, topBar: true, keepAlive: true }
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
      path: "/predict-battle",
      name: "predict-battle",
      component: PredictBattle,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/predict-detail/:id',
      name: 'predict-detail',
      component: PredictDetail
    },
    {
      path: '/mindshare',
      name: 'mindshare',
      component: MindShareIndex
    },
    {
      path: '/staking/:user?',
      name: 'staking',
      component: () => import('@/views/profile/StakingView.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // Mini Apps Routes
    {
      path: '/miniapps',
      name: 'miniapps',
      component: MiniAppsExplore,
      meta: { tabBar: true, topBar: true }
    },
    {
      path: '/miniapps/:appId',
      name: 'miniapp',
      component: MiniAppView,
      meta: { tabBar: false, topBar: false }
    },
    // DeFi Actions Test - Host wrapper
    {
      path: '/test-defi-host',
      name: 'test-defi-host',
      component: () => import('@/views/MiniApp/TestDeFiMiniApp.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // DeFi Actions Test - Mini App content (loaded in iframe)
    {
      path: '/test-defi',
      name: 'test-defi',
      component: () => import('@/views/MiniApp/DeFiActionsTest.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // SDK Full Test - Host wrapper
    {
      path: '/sdk-test-host',
      name: 'sdk-test-host',
      component: () => import('@/views/MiniApp/SDKTestHost.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // SDK Full Test - Mini App content (loaded in iframe)
    {
      path: '/sdk-test',
      name: 'sdk-test',
      component: () => import('@/views/MiniApp/SDKFullTest.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // Testnet DeFi Test - Host wrapper
    {
      path: '/testnet-defi-host',
      name: 'testnet-defi-host',
      component: () => import('@/views/MiniApp/TestnetDeFiHost.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // Testnet DeFi Test - Mini App content (loaded in iframe)
    {
      path: '/testnet-defi',
      name: 'testnet-defi',
      component: () => import('@/views/MiniApp/TestnetDeFiTest.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // Mainnet DeFi Test - Host wrapper
    {
      path: '/mainnet-defi-host',
      name: 'mainnet-defi-host',
      component: () => import('@/views/MiniApp/MainnetDeFiHost.vue'),
      meta: { tabBar: false, topBar: false }
    },
    // Mainnet DeFi Test - Mini App content (loaded in iframe)
    {
      path: '/mainnet-defi',
      name: 'mainnet-defi',
      component: () => import('@/views/MiniApp/MainnetDeFiTest.vue'),
      meta: { tabBar: false, topBar: false }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const account = useAccountStore().getAccountInfo
  if (to.meta.gotoHome && !account?.twitterId) {
    // 保存当前路由，登录成功后返回此页面
    localStorage.setItem('current-route', from.fullPath);
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    next({
      path: from.fullPath
    })
    return
  }
  next();
})

export default router
