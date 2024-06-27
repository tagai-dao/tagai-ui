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
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
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
    }
  ]
})

export default router
