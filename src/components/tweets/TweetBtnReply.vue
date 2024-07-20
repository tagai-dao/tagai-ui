<script setup lang="ts">
import {parseTimestamp} from "@/utils/helper";
import {checkAccessToken} from "@/apis/api";
import {handleErrorTip, notify} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import {useTweet} from "@/composables/useTweet";
import {usePost} from "@/composables/usePost";
import TweetInput from "@/components/tweets/TweetInput.vue";
import { type Tweet } from "@/types";

const props = defineProps<{ tweet: Tweet}>()
const emits = defineEmits(['newComment'])
const { content, imgurls, profileImg } = usePost(props.tweet);

const stateStore = useStateStore()
const isRepling = ref(false)
const replyVisible = ref(false)
const {formatEmojiText} = useTweet()

const preReply = async () => {
  replyVisible.value = true

  // if (postCondition.value === 0) {
  //   console.log(6)
  //   // check access token
  //   const v = await checkAccessToken();
  //   if (!v) {
  //     stateStore.showTwitterLogin = true;
  //     return;
  //   }
  //   console.log(55)
  //   replyVisible.value = true
  // } else if (postCondition.value == 1) {
  //   stateStore.showBtcLogin = true
  // } else {
  //   stateStore.loginTipType = "comment";
  //   stateStore.globalLoginTip = true;
  // }
};

const tweetInputRef = ref()
async function userReply() {
  console.log(tweetInputRef.value.leftWordsLength)
  console.log(tweetInputRef.value.contentRef)
  const text = tweetInputRef.value.formatElToTextContent(tweetInputRef.value.contentRef)
  const tweetLength = 280 - tweetInputRef.value.leftWordsLength??0
  // check text
  if (tweetLength > 280) {
    notify({
      message: "The length of content is too long.",
      type: 'info'
    })
    return
  }
  // checkout twitter login
  if (tweetLength == 0) {
    notify({
      message: 'Please write something.'
    })
    return;
  }

  try{
    isRepling.value = true
    // const commented: any = await newComment(props.tweet.tweetId, text)
    // if (commented) {
    //   replyVisible.value = false
    //   emits('newComment', props.tweet.tweetId, commented.id, text)
    // }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    isRepling.value = false
  }
}

</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="preReply"
          :disabled="isRepling">
    <i-ep-loading v-if="isRepling" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5" :class="tweet.replied ? 'btn-icon-reply-active' : 'btn-icon-reply'"></i>
    <span class="text-sm font-bold"
          :class="tweet.replied ? 'text-red-ff' : 'text-grey-bd'">
        {{ tweet.replyCount ?? 0 }}</span>
  </button>

  <!--    reply-->
  <el-dialog v-model="replyVisible"
             modal-class="overlay-white"
             class="max-w-[500px] rounded-[20px]"
             width="90%" :show-close="false" align-center destroy-on-close>
    <div class="flex-1 overflow-hidden py-5 max-h-[80vh]">
      <div class="flex justify-start items-stretch gap-2">
        <img v-if="profileImg" class="w-8 h-8 min-w-8 min-h-8 rounded-full"
             :src="profileImg" alt=""/>
        <img v-else class="w-8 h-8 min-w-8 min-h-8 rounded-full"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="flex-1">
          <div class="flex-1">
            <div class="text-base font-semibold leading-4">
              {{ tweet.twitterName??'Username' }}
            </div>
            <div class="flex items-center gap-1 text-grey-light-active leading-3">
                <span class="text-sm">
                  @{{ tweet.twitterUsername??'username' }}
                </span>
              <span class=""> · </span>
              <span class="whitespace-nowrap">
                  {{ parseTimestamp(tweet.tweetTime)??'**' }}
                </span>
            </div>
          </div>
          <div class="text-left font-normal mt-2">
            <div class="text-sm leading-5 whitespace-pre-line break-word multi-content"
                 v-html="formatEmojiText(content)"></div>
            <div v-if="imgurls" class="">
              <span v-for="(url, index) of imgurls.slice(0, 4)" :key="index" :title="url">[Pic]</span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <TweetInput ref="tweetInputRef" :max-length="280" :tick="tweet.tick">
          <template #placeholder>
            Write comment to the tweet here
          </template>
        </TweetInput>
      </div>
      <div class="flex justify-end mt-3">
        <button class="h-10 px-5 bg-gradient-primary text-white font-bold rounded-full text-lg
                         flex items-center justify-center gap-2 disabled:opacity-30"
                :disabled="isRepling"
                @click="userReply">
          <span class="text-white text-h5">Reply</span>
          <i-ep-loading v-if="isRepling" class="w-4 h-4"/>
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>

</style>
