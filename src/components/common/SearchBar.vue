<script setup lang="ts">
import {ref, watch} from "vue";
import debounce from "lodash.debounce"
import { searchCommunity, getTweetById, getUserTweets, getTweetBySpaceId, getUsernameTweets } from "@/apis/api";
import { type Community, type Tweet } from "@/types";
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
      tweetsList.value = await getUsernameTweets(searchResult.value.id as string) as any
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
        <div v-if="searchResult.type != 'community' && tweetsList.length > 0" class="grid h-screen overflow-auto">
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
      </div>
    </el-collapse-transition>
  </div>
</template>

<style scoped>

</style>
