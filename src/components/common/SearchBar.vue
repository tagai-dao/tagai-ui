<script setup lang="ts">
import {onDeactivated, onMounted, onUnmounted, ref, watch} from "vue";
import debounce from "lodash.debounce"
import { searchCommunity, getTweetById, getTweetBySpaceId, searchMindShareByUsername, getTokenByTickOrCA } from "@/apis/api";
import { type Community, type MindShare, type Tweet } from "@/types";
import TagListItem from "../home/TagListItem.vue";
import { useCommunityStore } from "@/stores/community";
import { useRoute, useRouter } from "vue-router";
import { useChainStore } from '@/stores/chain';
import { handleErrorTip } from '@/utils/notify';
import defaultAvatar from '@/assets/icons/icon-default-avatar-v2.png';

type SearchResult = {
  type: 'tweet' | 'space' | 'user' | 'community' | 'ca'
  id: string
}

const searchText = ref('')
const searchRef = ref<HTMLElement | null>(null)
const showSearchList = ref(false);
const searchResult = ref<SearchResult>({
  type: 'community',
  id: ''
})
const list = ref<Community[]>([])
const tweetsList = ref<Tweet[]>([])
const mindShareList = ref<MindShare[]>([])
const comStore = useCommunityStore();
const router = useRouter();
const route = useRoute();
const chainStore = useChainStore();
let searchSequence = 0;
const spaceRegex = /https:\/\/(twitter|x)\.com\/i\/spaces\/([0-9a-z-A-Z]+)(\/\w)?/
const tweetRegex = /https:\/\/(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)(\/\w)?/
const userRegex = /^@([a-zA-Z0-9_]+)/
// 加密用户习惯：直接粘贴合约地址定位代币
const caRegex = /^0x[0-9a-fA-F]{40}$/

const testSearchText = (text: string) => {
  if(caRegex.test(text)) {
    return {
      type: 'ca',
      id: text
    }
  }
  if(tweetRegex.test(text)) {
    const match = text.match(tweetRegex);
    if (match) {
      return {
        type: 'tweet',
        id: match[3]
      }
    }
  }
  if(spaceRegex.test(text)) {
    const match = text.match(spaceRegex);
    if (match) {
      return {
        type: 'space',
        id: match[2]
      }
    }
  }
  if(userRegex.test(text)) {
    const match = text.match(userRegex);
    if (match) {
      return {
        type: 'user',
        id: match[1]
      }
    }
  }
  return {
    type: 'community',
    id: text
  }
}

const runSearch = debounce(async (text: string, sequence: number) => {
  const result = testSearchText(text) as SearchResult
  const isCurrent = () => sequence === searchSequence
  try {
    let communities: Community[] = []
    let tweets: Tweet[] = []
    let users: MindShare[] = []
    switch(result.type) {
    case 'ca': {
      // 粘贴合约地址 → 命中则作为社区结果展示，点击直达 tag-detail
      const token = await getTokenByTickOrCA(result.id) as any
      communities = token?.tick ? [token] : []
      break
    }
    case 'tweet':
      tweets = [await getTweetById(result.id) as any].filter(Boolean)
      break
    case 'space':
      tweets = [await getTweetBySpaceId(result.id) as any].filter(Boolean)
      break
    case 'user':
      users = await searchMindShareByUsername(result.id) as any
      break
    case 'community':
      communities = await searchCommunity(result.id) as any
      break
    }
    // A dismissed panel or an older request must not reopen/replace the results.
    if (!isCurrent()) return
    searchResult.value = result
    list.value = communities || []
    tweetsList.value = tweets
    mindShareList.value = users || []
    showSearchList.value = true
  } catch (error) {
    if (isCurrent()) handleErrorTip(error)
  }
}, 500)

function dismissSearch() {
  searchSequence++
  runSearch.cancel()
  showSearchList.value = false
}

function onInput() {
  dismissSearch()
  list.value = []
  tweetsList.value = []
  mindShareList.value = []
  const text = searchText.value.trim()
  if (text) runSearch(text, searchSequence)
}

function onPointerDown(event: PointerEvent) {
  if (searchRef.value && !event.composedPath().includes(searchRef.value)) dismissSearch()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  dismissSearch()
})
onDeactivated(dismissSearch)
watch(() => route.fullPath, dismissSearch)
watch(() => chainStore.activeChainId, dismissSearch)

const clearSearchList = () => {
  searchText.value = ''
  onInput()
}

function gotoDetail(com: Community) {
  dismissSearch()
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}

function gotoTweet(tweet: Tweet) {
  dismissSearch()
  router.push(`/post-detail/${tweet.tweetId}`)
}

function gotoProfile(username: string) {
  dismissSearch()
  router.push(`/user/${username}`)
}

</script>

<template>
  <div class="relative flex min-w-0 flex-1 justify-end" ref="searchRef" role="search" @keydown.esc="dismissSearch">
    <div class="search-bar relative flex h-12 w-full items-center gap-3 rounded-full border border-line bg-white px-5 shadow-sm transition-shadow focus-within:border-orange-normal focus-within:shadow-[0_0_0_3px_rgba(254,145,63,0.12)] dark:bg-surface-2">
      <img class="h-5 w-5 shrink-0" src="~@/assets/icons/icon-search-grey.svg" alt="">
      <input type="text" :placeholder="$t('search')"
             v-model="searchText"
             @input="onInput"
             @focus="onInput"
             @keydown.enter.prevent="onInput"
             :aria-expanded="showSearchList"
             class="relative h-full min-w-0 flex-1 rounded-full bg-transparent pr-8 text-base outline-none" >
      <button v-if="searchText.trim().length>0"
              type="button" :aria-label="$t('clearSearch')"
              @click="clearSearchList"
              class="absolute right-4 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-2 text-content hover:text-orange-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-normal">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <el-collapse-transition>
      <div v-show="showSearchList"
           class="absolute top-14 left-0 right-0 z-[999] rounded-2xl border border-line bg-white px-4 py-6 shadow-popper-tip dark:bg-surface-2">

        <div v-if="searchResult.type === 'community' || searchResult.type === 'ca'" class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
          <TagListItem v-for="community of list" :community :key="community.tick" @click="gotoDetail(community)"/>
        </div>
        <div v-if="(searchResult.type == 'tweet' || searchResult.type == 'space') && tweetsList.length > 0" class="grid h-screen overflow-auto">
          <div v-for="(tweet, index) of tweetsList" :key="tweet.tweetId" @click="gotoTweet(tweet)" class="mb-2">
            <SpaceItem
              v-if="tweet.spaceId"
              class="bg-white rounded-2xl"
              :tweet="tweet"
            >
            </SpaceItem>
            <TweetItem
              v-else
              class="bg-white rounded-2xl"
              :tweet="tweet"
            >
            </TweetItem>
          </div>
        </div>
        <div v-if="searchResult.type == 'user' && mindShareList.length > 0" class="h-screen overflow-auto">
          <div class="w-full">
            <div class="flex gap-2 items-center px-3 py-3 border-b-[0.5px] text-h5 sticky top-0 bg-white z-[99]">
              <div class="web:min-w-[140px] web:max-w-full web:flex-1">Name</div>
              <div class="min-w-[80px] max-w-[80px] web:min-w-[120px] web:max-w-[120px]">Mindshare</div>
              <div class="min-w-[80px] max-w-[100px]">24h</div>
              <div class="min-w-[80px] max-w-[100px]">7d</div>
            </div>
            <div class="flex gap-2 items-center px-3 py-3 hover:bg-grey-light border-b-[0.5px]"
                 v-for="(item, index) of mindShareList" :key="item.twitterName">
              <button @click="gotoProfile(item.twitterUsername)" class="min-w-[140px] max-w-[120px] web:min-w-[140px] web:max-w-full web:flex-1 flex gap-2 items-center overflow-hidden">
                <div class="w-6 h-6 min-w-6 web:w-8 web:h-8 web:min-w-8 web:min-h-8 bg-grey-light rounded-lg overflow-hidden">
                  <img class="w-6 h-6 web:w-8 web:h-8 object-cover" :src="item.profile || defaultAvatar" alt="">
                </div>
                <div class="flex flex-col">
                  <span class="text-sm web:text-h4 font-medium text-start break-words">{{ item.twitterName }}</span>
                  <span class="text-sm text-start break-words">@{{item.twitterUsername}}</span>
                </div>
              </button>
              <div class="min-w-[80px] max-w-[80px] web:min-w-[80px] web:max-w-[800px] flex gap-2 items-center">
                <div class="text-sm">{{(item.mindSharePercent * 100).toFixed(2) }}%</div>
              </div>
              <div class="min-w-[80px] max-w-[100px]">
                <div v-if="item.delta24h>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
              <div class="min-w-[90px] max-w-[100px]">
                <div v-if="item.delta7d>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<style scoped>

</style>
