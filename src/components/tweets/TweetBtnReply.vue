<script setup lang="ts">
import {parseTimestamp} from "@/utils/helper";
import {checkAccessToken} from "@/apis/api";
import {handleErrorTip, notify} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import {useTweet} from "@/composables/useTweet";
import {usePost} from "@/composables/usePost";
import TweetInput from "@/components/tweets/TweetInput.vue";
import { type Tweet } from "@/types";

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newComment'])
const { content, imgurls, profileImg } = usePost(props.tweet);

const stateStore = useStateStore()
const isRepling = ref(false)
const replyVisible = ref(false)
const {formatEmojiText} = useTweet()
const {
  contentRef,
  tweetLength,
  formatElToTextContent
} = useCreateTweet(280)

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

async function userReply() {
  const text = formatElToTextContent(contentRef.value)
  // check text
  if (tweetLength.value > 280) {
    notify({
      message: "The length of content is too long.",
      type: 'info'
    })
    return
  }
  // checkout twitter login
  if (tweetLength.value == 0) {
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
          :class="tweet.replyCount ? 'text-red-ff' : 'text-grey-bd'">
        {{ tweet.replyCount ?? 0 }}</span>
  </button>

  <!--    reply-->
  <el-dialog v-model="replyVisible"
             modal-class="overlay-white"
             class="max-w-[500px] rounded-[20px]"
             width="90%" :show-close="false" align-center destroy-on-close>
    <div class="min-h-[40vh] sm:min-h-[300px] sm:pt-5 max-h-[80vh] relative">
      <div class="flex-1 overflow-auto no-scroll-bar py-2.5">
        <div class="flex justify-start items-stretch gap-2">
          <img class="rounded-full gradient-border w-10 h-10 min-w-10"
               :src="profileImg" alt=""/>
          <div class="flex-1">
            <div class="flex-1 flex items-center flex-wrap">
              <div class="flex items-center flex-wrap">
                  <span class="font-bold text-left mr-3 cursor-pointer text-lg text-black">
                    {{ tweet.twitterName }}
                  </span>
              </div>
              <div class="flex flex-wrap items-center gap-1 text-grey-normal-hover text-sm">
                <span class="">
                  @{{ tweet.twitterUsername }}
                </span>
                <span> · </span>
                <span class="whitespace-nowrap">
                  {{ parseTimestamp(tweet.tweetTime) }}
                </span>
              </div>
            </div>
            <div class="text-left font-400 mt-0.5rem">
              <div class="text-black-3f font-medium text-base">
                <div class="whitespace-pre-line break-word multi-content"
                    v-html="formatEmojiText(content)"></div>
              </div>
              <div v-if="imgurls" class="text-colorD9 light:text-color46">
                  <span v-for="(url, index) of imgurls.slice(0, 4)" :key="index" :title="url">[Pic]</span>
              </div>
            </div>
          </div>
        </div>
        <div class="border-1 border-gray-400 rounded-md">
          <TweetInput ref="tweetInput" :max-length="280">
            <template #placeholder>
              Write comment to the tweet here
            </template>
          </TweetInput>
        </div>
        <div class="flex justify-end my-1rem">
          <button class="h-11 px-10 border-1 gradient-border shadow-shadow1C rounded-full
                  flex justify-center items-center space-x-2"
                  :disabled="isRepling"
                  @click="userReply">
            <span class="text-gradient bg-primaryGradient text-18px">Comment</span>
            <i-ep-loading v-if="isRepling" class="w-4 h-4"/>
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>

</style>
