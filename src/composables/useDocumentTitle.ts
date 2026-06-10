import { watchEffect } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCommunityStore } from '@/stores/community'
import { useCurationStore } from '@/stores/curation'
import i18n from '@/lang'

// 路由名 -> i18n key（已有四语翻译的导航词直接复用）
const routeTitleKeys: Record<string, string> = {
  home: 'home',
  commerce: 'home',
  coins: 'coin',
  predictions: 'prediction',
  profile: 'profile',
  wallet: 'wallet',
  notification: 'notification',
  'login-call-back': 'login',
  'clanker-token': 'Token',
  'tip-record': 'tips',
  'predict-battle': 'createPredict.tabBattle',
  'predict-event': 'createPredict.tabEvent',
  about: 'about'
}

function trimTitle(value: string, maxLength = 60) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized
}

function getPageTitle(route: RouteLocationNormalizedLoaded) {
  const communityStore = useCommunityStore()
  const curationStore = useCurationStore()
  const routeName = typeof route.name === 'string' ? route.name : ''

  if (routeName === 'tag-detail' || routeName === 'buy-sell') {
    const tick = String(route.params.id ?? '')
    const community = communityStore.currentSelectedCommunity
    if (community?.tick === tick) {
      return community.name || `#${community.tick}`
    }
    return tick ? `#${tick}` : 'Community'
  }

  if (routeName === 'post-detail') {
    const tweetId = String(route.params.id ?? '')
    const tweet = curationStore.currentSelectedTweet
    if (tweet?.tweetId === tweetId) {
      return trimTitle(tweet.content || (tweet.tick ? `#${tweet.tick}` : 'Post'))
    }
    return 'Post'
  }

  if (routeName === 'space-detail') {
    const space = curationStore.currentSelectedSpace
    return trimTitle(space?.title || (space?.tick ? `#${space.tick} Space` : 'Space'))
  }

  if (routeName === 'user') {
    const username = String(route.params.username ?? '')
    return username ? `@${username}` : 'User'
  }

  const key = routeTitleKeys[routeName]
  if (key) {
    // @ts-ignore composition t
    const translated = i18n.global.t(key)
    return translated === key ? key : translated
  }
  return 'TagAI'
}

export function useDocumentTitle(route: RouteLocationNormalizedLoaded) {
  watchEffect(() => {
    // i18n.global.t 订阅 locale，语言切换时标题随之更新
    const pageTitle = getPageTitle(route)
    document.title = pageTitle === 'TagAI' ? pageTitle : `${pageTitle} | TagAI`
  })
}
