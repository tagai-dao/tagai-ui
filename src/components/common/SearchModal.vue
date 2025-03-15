<script setup lang="ts">
import { searchCommunity, getTweetById, getUserTweets, getTweetBySpaceId, getUsernameTweets } from "@/apis/api";
import { type Community, type Tweet } from '@/types';
import debounce from 'lodash.debounce'
import { ref } from 'vue'
import TagListItem from '../home/TagListItem.vue';
import { useCommunityStore } from '@/stores/community';
import { useRouter } from 'vue-router';

const emit = defineEmits(['onClose'])
const list = ref<Community[]>([])
const tweetsList = ref<Tweet[]>([])
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
      tweetsList.value = await getUsernameTweets(searchResult.value.id as string) as any
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
      <div v-if="searchResult.type != 'community' && tweetsList.length > 0" class="gap-2 h-screen overflow-auto">
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

    </div>
  </div>
</template>

<style scoped>

</style>
