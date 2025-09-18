<script setup lang="ts">
import {ref, watch} from "vue";
import debounce from "lodash.debounce"
import { searchCommunity, getTweetById, getUserTweets, getTweetBySpaceId, searchMindShareByUsername } from "@/apis/api";
import { type Community, type MindShare, type Tweet } from "@/types";
import TagListItem from "../home/TagListItem.vue";
import { useCommunityStore } from "@/stores/community";
import { useRouter } from "vue-router";

type SearchResult = {
  type: 'tweet' | 'space' | 'user' | 'community'
  id: string
}

const searchText = ref('')
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
const spaceRegex = /https:\/\/(twitter|x)\.com\/i\/spaces\/([0-9a-z-A-Z]+)(\/\w)?/
const tweetRegex = /https:\/\/(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)(\/\w)?/
const userRegex = /^@([a-zA-Z0-9_]+)/

const onSearch = (e: any) => {
  if(searchText.value.trim().length > 0 && e.keyCode === 13) {
    showSearchList.value = true
  }
}

const testSearchText = (text: string) => {
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

const onInput = debounce(async () => {
  list.value = []
  tweetsList.value = []
  if(!searchText.value.trim()) showSearchList.value = false
  searchResult.value = testSearchText(searchText.value.trim()) as SearchResult
  switch(searchResult.value.type) {
    case 'tweet':
      tweetsList.value = [await getTweetById(searchResult.value.id as string) as any]
      break
    case 'space':
      tweetsList.value = [await getTweetBySpaceId(searchResult.value.id as string) as any]
      break
    case 'user':
      mindShareList.value = await searchMindShareByUsername(searchResult.value.id as string) as any
      break
    case 'community':
      list.value = await searchCommunity(searchResult.value.id as string) as any
      break
  }
  showSearchList.value = true
}, 500)

const clearSearchList = () => {
  searchText.value = ''
  showSearchList.value = false
}

function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  router.push(`/tag-detail/${com.tick}`)
}

function gotoTweet(tweet: Tweet) {
  router.push(`/post-detail/${tweet.tweetId}`)
}

function gotoProfile(username: string) {
  router.push(`/user/${username}`)
}

</script>

<template>
  <div class="relative flex-1 flex justify-end" ref="searchRef">
    <div class="search-bar relative w-full bg-white flex items-center rounded-full px-4 gap-3 ">
      <img src="~@/assets/icons/icon-search-grey.svg" alt="">
      <input type="text" :placeholder="$t('search')"
             v-model="searchText"
             @input="onInput"
             class="flex-1 bg-transparent relative rounded-full text-base" >
      <button v-if="searchText.trim().length>0"
              @click="clearSearchList"
              class="absolute right-4 bg-grey-light rounded-full">
        <img class="w-6 h-6" src="~@/assets/icons/icon-modal-close.svg" alt="">
      </button>
    </div>
    <el-collapse-transition>
      <div v-show="showSearchList"
           class="absolute top-14 bg-white left-0 right-0 rounded-2xl px-4 py-6 z-[999]">

        <div v-if="searchResult.type === 'community'" class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
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
                  <img class="w-6 h-6 web:w-8 web:h-8" :src="item.profile" alt="">
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
