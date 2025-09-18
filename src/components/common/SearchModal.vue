<script setup lang="ts">
import { searchCommunity, getTweetById, getUserTweets, getTweetBySpaceId, searchMindShareByUsername } from "@/apis/api";
import { type Community, type MindShare, type Tweet } from '@/types';
import debounce from 'lodash.debounce'
import { ref } from 'vue'
import TagListItem from '../home/TagListItem.vue';
import { useCommunityStore } from '@/stores/community';
import { useRouter } from 'vue-router';

const emit = defineEmits(['onClose'])
const list = ref<Community[]>([])
const tweetsList = ref<Tweet[]>([])
const mindShareList = ref<MindShare[]>([])
const comStore = useCommunityStore()
const router = useRouter()
const searchText = ref('')
const searchResult = ref<SearchResult>({
  type: 'community',
  id: ''
})
const spaceRegex = /https:\/\/(twitter|x)\.com\/i\/spaces\/([0-9a-z-A-Z]+)(\/\w)?/
const tweetRegex = /https:\/\/(twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)(\/\w)?/
const userRegex = /^@([a-zA-Z0-9_]+)/

type SearchResult = {
  type: 'tweet' | 'space' | 'user' | 'community'
  id: string
}

const testSearchText = (text: string) => {
  console.log(text)
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
}, 500)


function gotoDetail(com: Community) {
  comStore.currentSelectedCommunity = com
  emit('onClose')
  router.push(`/tag-detail/${com.tick}`)
}

function gotoTweet(tweet: Tweet) {
  emit('onClose')
  router.push(`/post-detail/${tweet.tweetId}`)
}

function gotoProfile(username: string) {
  emit('onClose')
  router.push(`/user/${username}`)
}

</script>

<template>
  <div>
    <div class="py-3 flex gap-2">
      <button class="h-12 w-12 min-w-12 bg-white rounded-full shadow-popper-tip
                     flex items-center justify-center"
              @click="$emit('onClose')">
        <img src="../../assets/icons/icon-back.svg" alt="">
      </button>
      <div class="flex-1 h-12 min-h-12 rounded-full bg-white shadow-popper-tip overflow-hidden px-4
                  flex items-center">
        <input type="text" class="w-full h-full" @input="onInput" v-model="searchText" :placeholder="$t('search')">
        <img src="~@/assets/icons/icon-search-outline.svg" alt="">
      </div>
    </div>
    <div class="mt-3">
      <!-- <div class="px-3 font-medium text-lg text-black mb-1">User</div>
      <div class="bg-white p-4 rounded-2xl shadow-popper-tip flex items-center gap-1.5 mb-2"
           v-for="i of 2" :key="i">
        <img class="h-10 w-10 min-h-10 rounded-full"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="flex-1">
          <div>@username</div>
          <div class="text-grey-light-active">ipShare: 895</div>
        </div>
      </div>
      <div class="px-3 font-medium text-lg text-black mt-4 mb-1">Tag</div> -->
      <div v-if="searchResult.type === 'community'" class="grid grid-cols-1 md:grid-cols-2 web:grid-cols-3 gap-2">
        <TagListItem v-for="community of list" :community :key="community.tick" @click="gotoDetail(community)"/>
        <!-- <button class="h-6 px-3 rounded-md bg-green-normal text-sm"
                v-for="i of 4" :key="i">
          onChain
        </button> -->
      </div>
      <div v-if="(searchResult.type == 'tweet' || searchResult.type == 'space') && tweetsList.length > 0" class="gap-2 h-screen overflow-auto">
        <div class="max-h-full">
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
      <div v-if="searchResult.type == 'user' && mindShareList.length > 0" class="gap-2 h-screen overflow-auto">
        <div class="max-h-full">
          <div class="w-full">
            <div class="flex gap-2 items-center px-3 py-3 border-b-[0.5px] text-h5 sticky top-0 bg-white z-[99]">
              <div class="min-w-[50px] web:min-w-[80px] hidden web:block">#</div>
              <div class="w-1/2">Name</div>
              <div class="w-1/2 text-center">Mindshare</div>
            </div>
            <div class="flex gap-2 items-center px-3 py-3 hover:bg-grey-light border-b-[0.5px]"
                 v-for="(item, index) of mindShareList" :key="item.twitterName">
              <div class="min-w-[50px] web:min-w-[80px] text-sm hidden web:block">{{index+1}}</div>
              <button @click="gotoProfile(item.twitterUsername)" class="w-1/2 flex gap-2 items-center">
                <div class="w-6 h-6 min-w-6 web:w-8 web:h-8 web:min-w-8 web:min-h-8 bg-grey-light rounded-lg overflow-hidden">
                  <img class="w-6 h-6 web:w-8 web:h-8" :src="item.profile" alt="">
                </div>
                <div class="flex flex-col justify-start">
                  <span class="text-sm web:text-h4 font-medium break-words text-start">{{ item.twitterName }}</span>
                  <span class="text-sm break-words text-start">@{{item.twitterUsername}}</span>
                </div>
              </button>
              <div class="w-1/2 flex gap-2 justify-center items-center text-center">
                <div class="text-sm">{{(item.mindSharePercent * 100).toFixed(2) }}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>

</style>
