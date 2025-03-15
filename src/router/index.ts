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

const router = createRouter({
  // @ts-ignore
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:commerceid?',
      name: 'home',
      component: HomeView,
      meta: {tabBar: true, topBar: true, keepAlive: true}
    },
    {
      path: '/commerce/:commerceid?',
      name: 'commerce',
      component: HomeView,
      meta: {tabBar: true, topBar: true, keepAlive: true}
    },
    {
      path: '/tag-detail/:id/:sellsman?',
      name: 'tag-detail',
      component: HomeTagDetail,
      meta: {tabBar: true, topBar: true, keepAlive: true}
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
      meta: {tabBar: true, topBar: true, gotoHome: true, keepAlive: true}
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: WalletView,
      meta: {tabBar: true, topBar: true, gotoHome: true, keepAlive: true}
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
      meta: {tabBar: true, topBar: true}
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const account = useAccountStore().getAccountInfo
  if (to.meta.gotoHome && !account?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    next({
      path: from.fullPath
    })
    return
  }
  next();
})

export default router
