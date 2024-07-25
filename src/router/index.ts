import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:commerceid?',
      name: 'home',
      component: HomeView,
      meta: {tabBar: true, topBar: true}
    },
    {
      path: '/tag-detail/:id',
      name: 'tag-detail',
      component: () => import('@/views/tag-detail/HomeTagDetail.vue'),
      meta: {tabBar: true, topBar: true}
    },
    {
      path: '/buy-sell/:id/:sellsman?',
      name: 'buy-sell',
      component: () => import('@/views/buy-sell/BuyAndSellView.vue')
    },
    {
      path: '/space-detail/:id',
      name: 'space-detail',
      component: () => import('@/views/space-detail/TweetSpaceDetail.vue')
    },
    {
      path: '/post-detail/:id',
      name: 'post-detail',
      component: () => import('@/views/post-detail/TweetPostDetail.vue')
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/profile/ProfileView.vue'),
      meta: {tabBar: true, topBar: true, gotoHome: true}
    },
    {
      path: '/notification',
      name: 'notification',
      component: () => import('@/views/notification/NotificationView.vue')
    },
    {
      path: '/login',
      name: 'login-call-back',
      component: () => import('@/views/LoginCallBack.vue')
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
