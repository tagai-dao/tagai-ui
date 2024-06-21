<template>
  <div class="flex justify-start items-center gap-88px flex-1 max-w-425px">
    <!-- like-->
    <button class="flex justify-center items-center"
            :disabled="isLiking || post.liked"
            @click.stop="userLike">
      <i-ep-loading v-if="isLiking" class="animate-spin w-5 h-5"/>
      <i v-else class="w-5 h-5 min-w-5"
         :class="post.liked ? 'btn-icon-like-active' : 'btn-icon-like'"></i>
      <span class="pl-8px text-12px"
            :class="post.liked ? 'text-gradient-primary' : 'text-colorA6'">
        {{ post.likeCount ?? 0 }}</span>
    </button>
    <el-tooltip v-if="false" popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
      <button @click.stop class="flex items-center">
        <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5"/>
        <i v-else class="w-5 h-5 min-w-5"
          :class="post.retweeted ? 'btn-icon-retweet-active' : 'btn-icon-retweet'"></i>
        <span class="px-8px text-12px"
              :class="post.retweeted ? 'text-gradient-primary' : 'text-colorA6'">
          {{ (post.countRetweet ?? 0) + (post.countQuote ?? 0) }}</span>
      </button>
      <template #content>
        <div class="flex flex-col gap-10px px-15px py-10px min-w-80px">
          <!-- retweet -->
          <button @click.stop="userRetweet"
                  :disabled="isRepling || isQuoting || isRetweeting || post.retweeted"
                  class="flex items-center">
            <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5"/>
            <span class="px-8px font-bold text-14px"
                  :class="post.retweeted ? 'text-gradient-primary' : 'text-colorA6'">
              {{ $t("postView.retweet") }} {{ post.retweetCount ?? 0 }}</span>
          </button>
          <!-- quote-->
          <button @click.stop="preQuote"
                  :disabled="isRepling || isQuoting || isRetweeting"
                  class="flex items-center">
            <i-ep-loading v-if="isQuoting" class="animate-spin w-5 h-5"/>
            <span class="px-8px font text-14px"
                  :class="post.quoted ? 'text-gradient-primary' : 'text-colorA6'">
              {{ $t("postView.quote") }} {{ post.quoteCount ?? 0 }}</span>
          </button>
        </div>
      </template>

    </el-tooltip>

    <!-- reply-->
    <button @click.stop="preReply" :disabled="isRepling || isQuoting || isRetweeting" class="flex justify-between items-center">
      <i-ep-loading v-if="isRepling" class="animate-spin w-5 h-5"/>
      <i v-else class="w-5 h-5 min-w-5" :class="post.replied ? 'btn-icon-reply-active' : 'btn-icon-reply'"></i>
      <span class="px-8px text-12px"
            :class="post.commentCount ? 'text-gradient-primary' : 'text-colorA6'">
        {{ post.commentCount ?? 0 }}</span>
    </button>

    <!--    reply-->
    <el-dialog @click.stop v-model="replyVisible" width="700" align-center title="" destroy-on-close>
      <div class="px-20px min-h-40vh sm:min-h-300px sm:pt-20px max-h-80vh relative">
        <!-- <i-ep-close
          class="modal-close-icon text-colorA6 w-24px h-24px absolute right-20px top-20px"
          @click="showDonate = false"
        /> -->
        <div class="flex-1 overflow-auto no-scroll-bar py-10px">
          <div class="flex justify-start items-stretch">
            <div class="flex flex-col items-center mr-10px md:mr-1rem">
              <img class="rounded-full gradient-border w-40px h-40px min-w-40px"
                   :src="profileImg" alt=""/>
              <div class="flex-1 my-10px w-2px bg-colorA6/30 light:bg-color7D"></div>
            </div>
            <div class="flex-1">
              <div class="flex-1 flex items-center flex-wrap">
                <div class="flex items-center flex-wrap">
                  <span
                    class="c-text-black text-left mr-3 cursor-pointer text-16px leading-18px 2xl:text-1rem 2xl:leading-1.5rem light:text-blueDark"
                  >
                    {{ post.twitterName }}
                  </span>
                </div>
                <div class="flex items-center id-time">
                  <span
                    class="text-12px leading-18px 2xl:text-14px 2xl:leading-18px text-colorA6 light:text-color7D"
                  >
                    @{{ post.twitterUsername }}
                  </span>
                  <span class="mx-4px text-colorA6 light:text-color7D"> · </span>
                  <span
                    class="whitespace-nowrap text-colorA6 light:text-color7D text-12px leading-18px 2xl:text-14px 2xl:leading-18px"
                  >
                    {{ parseTimestamp(post.postTime) }}
                  </span>
                </div>
              </div>
              <div class="text-left font-400 mt-0.5rem">
                <div
                  class="text-12px leading-18px 2xl:text-14px 2xl:leading-20px text-colorD9 light:text-color46"
                >
                  <div
                    class="whitespace-pre-line break-word multi-content"
                    v-html="formatEmojiText(content)"
                  ></div>
                </div>
                <div v-if="imgurls" class="text-colorD9 light:text-color46">
                  <span
                    v-for="(url, index) of imgurls.slice(0, 4)"
                    :key="index"
                    :title="url"
                    >[Pic]</span
                  >
                </div>
                <!--                <Repost class="mt-10px"-->
                <!--                        :is-reply="true"-->
                <!--                        @click.stop="clickRetweetView()"-->
                <!--                        v-if="post.retweetInfo && post.retweetInfo.length>10 && !isIgnoreAccount"-->
                <!--                        :retweetInfo="post.retweetInfo"/>-->
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
    <!--    quote-->
    <el-dialog v-model="quoteVisible" width="700" align-center title="" destroy-on-close>
      <div
        class="bg-color1C px-20px min-h-40vh sm:min-h-300px sm:pt-40px max-h-80vh relative"
      >
        <div class="modal-close-line text-center text-center">
          <button
            class="w-50px h-6px rounded-full bg-colorA6"
            @click="quoteVisible = false"
          ></button>
        </div>
        <i-ep-close
          class="modal-close-icon text-colorA6 w-24px h-24px absolute right-20px top-20px"
          @click="quoteVisible = false"
        />
        <div class="flex-1 overflow-hidden py-20px flex">
          <img
            class="mr-10px md:mr-1rem rounded-full gradient-border w-40px h-40px"
            :src="headerProfileImg()"
            alt=""
          />
          <div class="flex-1 overflow-x-hidden flex flex-col">
            <div class="flex flex-col relative max-h-30vh overflow-auto">
              <div v-show="showInputTip" class="absolute top-5px leading-24px 2xl:leading-18px opacity-50">
                {{
                  isDefaultQuote
                    ? $t("curation.quoteTip")
                    : $t("curation.inputCurationDes")
                }}
              </div>
              <div
                contenteditable
                class="z-1 flex-1 pt-5px whitespace-pre-line leading-24px 2xl:leading-18px content-input-box break-word"
                ref="contentRef"
                @blur="getBlur"
                @paste="onPaste"
                @input="contentInputChange"
                v-html="formatEmojiText(inputContent)"
              ></div>
            </div>
            <div class="mt-1rem border-1 border-color2A bg-color1C rounded-12px p-15px">
              <div class="flex items-center flex-wrap">
                <img
                  class="rounded-full gradient-border w-1.6rem h-1.6rem mr-5px min-w-1.6rem"
                  :src="profileImg"
                  alt=""
                />
                <div class="flex items-center flex-wrap">
                  <span
                    class="c-text-black text-left mr-3 cursor-pointer text-14px leading-18px"
                  >
                    {{ post.authorName }}
                  </span>
                </div>
                <div class="flex items-center id-time">
                  <span class="text-12px leading-18px text-colorA6 light:text-color7D">
                    @{{ post.authorUsername }}
                  </span>
                  <span class="mx-4px text-colorA6 light:text-color7D"> · </span>
                  <span
                    class="whitespace-nowrap text-12px leading-18px 2xl:text-14px 2xl:leading-18px text-colorA6 light:text-color7D"
                  >
                    {{ parseTimestamp(post.postTime) }}
                  </span>
                </div>
              </div>
              <div class="text-left font-400 mt-0.5rem">
                <div
                  class="text-12px leading-18px 2xl:text-14px 2xl:leading-20px text-colorD9 light:text-color46"
                >
                  <span v-if="isIgnoreAccount" class="text-blue-500 break-all">{{
                    steemUrl
                  }}</span>
                  <div
                    class="whitespace-pre-line break-word"
                    v-else
                    v-html="formatEmojiText(content)"
                  ></div>
                </div>
                <div v-if="imgurls" class="text-colorD9 light:text-color46">
                  <span
                    v-for="(url, index) of imgurls.slice(0, 4)"
                    :key="index"
                    :title="url"
                    >[Pic]</span
                  >
                </div>
              </div>
            </div>
            <div class="flex justify-between py-1rem">
              <div class="flex justify-between items-center">
                <el-popover
                  ref="emojiPopover"
                  placement="top"
                  trigger="click"
                  width="300"
                  :teleported="true"
                  :persistent="false"
                >
                  <template #reference>
                    <img
                      class="w-1.8rem h-1.8rem lg:w-1.4rem lg:h-1.4rem"
                      src="~@/assets/icons/icon-emoji.svg"
                      alt=""
                    />
                  </template>
                  <template #default>
                    <div class="h-310px lg:h-400px">
                      <EmojiPicker
                        :options="{
                          imgSrc: '/emoji/',
                          locals: $i18n.locale === 'zh' ? 'zh_CN' : 'en',
                          hasSkinTones: false,
                          hasGroupIcons: false,
                        }"
                        @select="(e) => selectEmoji(e)"
                      />
                    </div>
                  </template>
                </el-popover>
              </div>
              <button
                class="border-1 gradient-border shadow-shadow2A px-10px text-white w-120px min-w-120px h-40px rounded-full flex justify-center items-center gap-x-4px"
                :disabled="isQuoting"
                @click="userQuote"
              >
                <span class="text-gradient-primary">{{
                  isDefaultQuote ? $t("curation.tweet") : $t("postView.createNewCuration")
                }}</span>
                <i-ep-loading
                  v-if="isQuoting"
                  class="animate-spin w-18px h-18px text-white"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { parseTimestamp } from "@/utils/helper";
import { EmojiPicker } from "vue3-twemoji-picker-final";
import { useTimer } from "@/composables/useTools";
import { usePost } from "@/composables/usePost";
import { computed, defineProps, ref, withDefaults } from "vue";
import { useAccountStore } from "@/stores/web3";
import type { Tweet } from "@/types";
import { useStateStore } from "@/stores/common";
import { useTweetTip } from "@/composables/useTweetTips";
import { checkAccessToken, newLike } from "@/apis/api";
import { handleServerError, handleTransError } from "@/utils/notify";
import { notify } from "@/utils/notify";
import {useTweet} from "@/composables/useTweet";
import {useCreateTweet} from "@/composables/useCreateTweet";

const accStore = useAccountStore();
const props = withDefaults(
  defineProps<{
    post: Tweet;
  }>(),
  {
    post: {},
  }
);
const {formatEmojiText} = useTweet()
const {getBlur, onPaste, selectEmoji} = useCreateTweet()

const { content, urls, imgurls, profileImg, isIgnoreAccount, steemUrl } = usePost(props);
const { postCondition } = useTweetTip("mint");
const { setTimer } = useTimer();

const isFollowing = ref(false);
const isRepling = ref(false);
const isQuoting = ref(false);
const isRetweeting = ref(false);
const isLiking = ref(false);
const replyVisible = ref(false);
const quoteVisible = ref(false);
const inputContent = ref();
const tweetInput = ref()

const stateStore = useStateStore();
const emits = defineEmits(['newLike', 'newComment'])

const headerProfileImg = () => {
  console.log(666, accStore)
  if (!accStore.twitter) return null;
    if (accStore.twitter?.profile) {
      return accStore.twitter?.profile?.replace("normal", "200x200");
    } else {
      return (
        "https://profile-images.heywallet.com/" + accStore.twitter?.twitterId
      );
    }
}

const contentInputChange = () => {

}

const userLike = async () => {
  if (postCondition.value === 0) {
    try {
      // check access token
      const v = await checkAccessToken();
      if (!v) {
        stateStore.showTwitterLogin = true;
        return;
      }
      isLiking.value = true;
      await newLike(props.post.tweetId);
      emits('newLike', props.post.tweetId)
    } catch (e) {
      handleServerError(e);
    } finally {
      isLiking.value = false;
    }
  } else if (postCondition === 1) {
    stateStore.showBtcLogin = true
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};
const userRetweet = async () => {
  if (postCondition.value === 0) {
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};
const preQuote = () => {
  if (postCondition.value === 0) {
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};
const preReply = async () => {
  if (postCondition.value === 0) {
    console.log(6)
    // check access token
    const v = await checkAccessToken();
    if (!v) {
      stateStore.showTwitterLogin = true;
      return;
    }
    console.log(55)
    replyVisible.value = true
  } else if (postCondition.value == 1) {
    stateStore.showBtcLogin = true
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};

async function userReply() {
  const text = tweetInput.value?.formatElToTextContent(tweetInput.value?.contentRef)
  // check text
  if (tweetInput.value?.tweetLength > 280) {
    notify({
      message: "The length of content is too long.",
      type: 'info'
    })
    return
  }
  // checkout twitter login
  if (tweetInput.value?.tweetLength == 0) {
    notify({
      message: 'Please write something.'
    })
    return;
  }

  try{
    isRepling.value = true
    const commented = true // await newComment(props.post.tweetId, text)
    if (commented) {
      replyVisible.value = false
      emits('newComment', props.post.tweetId, commented.id, text)
    }
  } catch (e) {
    handleTransError(e)
  } finally {
    isRepling.value = false
  }
}

const clickRetweetView = () => {
  try {
    const info = JSON.parse(props.post.retweetInfo);
    window.open(`https://twitter.com/${info.author.username}/status/${info.id}`);
  } catch (error) {}
};
</script>

<style scoped></style>
