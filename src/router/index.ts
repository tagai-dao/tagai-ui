import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {tabbar: true}
    },
    {
      path: '/tag-detail/:id',
      name: 'tag-detail',
      component: () => import('@/views/tag-detail/HomeTagDetail.vue')
    },
    {
      path: '/buy-sell/:id',
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
      path: '/profile/:user',
      name: 'profile',
      component: () => import('@/views/profile/ProfileView.vue')
    },
    {
      path: '/login',
      name: 'login-call-back',
      component: () => import('@/views/LoginCallBack.vue')
    }
  ]
})

export default router
