import { watchEffect } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCommunityStore } from '@/stores/community'
import { useCurationStore } from '@/stores/curation'

const routeTitles: Record<string, string> = {
  home: 'Home',
  commerce: 'Home',
  profile: 'Profile',
  wallet: 'Wallet',
  notification: 'Notifications',
  'login-call-back': 'Login',
  'clanker-token': 'Token',
  'tip-record': 'Tip Records',
  'predict-battle': 'Prediction Battle',
  'predict-event': 'Prediction Market',
  about: 'About'
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

  return routeTitles[routeName] || 'TagAI'
}

export function useDocumentTitle(route: RouteLocationNormalizedLoaded) {
  watchEffect(() => {
    const pageTitle = getPageTitle(route)
    document.title = pageTitle === 'TagAI' ? pageTitle : `${pageTitle} | TagAI`
  })
}
