<script setup lang="ts">
import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import {parseTimestamp} from "@/utils/helper";
import {useAccountStore} from "@/stores/web3";
import {usePost} from "@/composables/usePost";
import {useCreateTweet} from "@/composables/useCreateTweet";
import {OperateType, useTweet} from "@/composables/useTweet";
import { type Tweet } from "@/types";
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { handleErrorTip } from "@/utils/notify";

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const accStore = useAccountStore();
const isQuoting = ref(false);
const quoteVisible = ref(false);

const {profileImg, isIgnoreAccount, steemUrl, imgurls, content} = usePost(props.tweet)
const {formatEmojiText, preCheckCuration, userQuote} = useTweet()
const {
  contentEl,
  contentRef,
  getBlur,
  onPaste,
  selectEmoji,
  contentInput,
  showClear,
  leftWordsLength,
  tweetLength,
  formatElToTextContent
} = useCreateTweet()

const headerProfileImg = () => {
  if (!accStore.getAccountInfo) return '';
  if (accStore.getAccountInfo?.profile) {
    return accStore.getAccountInfo?.profile?.replace("normal", "200x200");
  } else {
    return (
        "https://profile-images.heywallet.com/" + accStore.getAccountInfo?.twitterId
    );
  }
}

const preQuote = async () => {
  try{
    isQuoting.value = true
    if (await preCheckCuration(OperateType.QUOTE, props.tweet)) {
      quoteVisible.value = true
    }
  } catch (e) {
    console.log(344, e)
    handleErrorTip(e)
  } finally {
    isQuoting.value = false
  }
};

const quote = async () => {
  try{
    if (leftWordsLength.value < 0 || tweetLength.value == 0) {
      return;
    }
    const text = formatElToTextContent(contentRef.value);
    isQuoting.value = true;
    await userQuote(props.tweet, text, props.tweet.tick!)
    quoteVisible.value = false
    props.tweet.quoteCount += 1;
    props.tweet.quoted = 1;
  } catch (e) {
    handleErrorTip(e)
  } finally {
    isQuoting.value = false
  }
}

</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="preQuote"
          :disabled="isQuoting">
    <i-ep-loading v-if="isQuoting" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="tweet.quoted ? 'btn-icon-quote-active' : 'btn-icon-quote'"></i>
    <span class="text-sm font-bold"
          :class="tweet.quoted ? 'text-orange-normal' : 'text-grey-bd'">
              {{ tweet.quoteCount ?? 0 }}</span>
  </button>
  <el-dialog v-model="quoteVisible"
             modal-class="overlay-white"
             class="max-w-[500px] rounded-[20px]"
             width="90%" :show-close="false" align-center destroy-on-close>
    <div class="flex-1 overflow-hidden py-5 flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <img class="w-8 h-8 rounded-full"
             :src="headerProfileImg()" alt=""/>
        <div class="text-h3 text-black">{{ useAccountStore().getAccountInfo.twitterName }}</div>
      </div>
      <div class="bg-grey-f0/90 rounded-2xl px-4 pb-4">
        <div class="max-h-[176px] overflow-hidden relative flex flex-col bg-grey-f0/90">
          <div contenteditable
               class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] pt-2 whitespace-pre-line
                      text-lg z-10 relative"
               ref="contentRef"
               @input="contentInput"
               @blur="getBlur"
               @paste="onPaste"
               v-html="contentEl"></div>
          <div v-if="!showClear" class="absolute top-3 left-0 text-14px leading-24px z-0 opacity-30">
            {{ $t('curation.tweetWithTickTip', {tick: '$' + tweet.tick}) }}
          </div>
          <div class="flex justify-between items-center mt-5">
            <div class="flex justify-between items-center">
            <el-popover ref="emojiPopover" trigger="click" width="300" :teleported="true" :persistent="false">
              <template #reference>
                <img class="w-8 h-8"
                     src="~@/assets/icons/icon-emoji.svg" alt=""/>
              </template>
              <template #default>
                <div class="h-[310px] lg:h-[400px]">
                  <EmojiPicker :options="{ imgSrc: '/emoji/', locals: 'en',hasSkinTones: false, hasGroupIcons: false}"
                               @select="(e: any) => selectEmoji(e)"/>
                </div>
              </template>
            </el-popover>
          </div>
            <div class="text-right text-sm">
              {{ leftWordsLength }}
            </div>
          </div>
        </div>
        <div class="my-3 bg-white border-[1px] border-grey-light rounded-xl p-3">
          <div class="flex items-center gap-2">
            <img v-if="profileImg" class="w-8 h-8 min-w-8 min-h-8 rounded-full"
                 :src="profileImg" alt=""/>
            <img v-else class="w-8 h-8 min-w-8 min-h-8 rounded-full"
                 src="~@/assets/icons/icon-default-avatar.svg" alt="">
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
          </div>
          <div class="text-left font-normal mt-2">
            <div class="text-sm leading-5">
              <span v-if="isIgnoreAccount" class="text-blue-500 break-all">{{steemUrl}}</span>
              <div v-else class="whitespace-pre-line break-word multi-content multi-content-2"
                   v-html="formatEmojiText(content)"></div>
            </div>
            <div v-if="imgurls" class="">
              <span v-for="(url, index) of imgurls.slice(0, 4)" :key="index" :title="url">[Pic]</span>
            </div>
          </div>
        </div>
        <div class="flex justify-end ">
          <button class="h-10 px-5 bg-gradient-primary text-white font-bold rounded-full text-lg
                         flex items-center justify-center gap-2 disabled:opacity-30"
                  :disabled="isQuoting"
                  @click="quote">
                <span class="text-white text-h5">
                  {{ $t("curation.quote") }}
                </span>
            <i-ep-loading v-if="isQuoting" class="animate-spin w-18px h-18px text-white"/>
          </button>
        </div>
      </div>
    </div>
  </el-dialog>

</template>

<style scoped>

</style>
