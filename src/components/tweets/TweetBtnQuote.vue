<script setup lang="ts">
import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import {parseTimestamp} from "@/utils/helper";
import {useAccountStore} from "@/stores/web3";
import {usePost} from "@/composables/usePost";
import {useCreateTweet} from "@/composables/useCreateTweet";
import {useTweet} from "@/composables/useTweet";
import { type Tweet } from "@/types";
import { EmojiPicker } from 'vue3-twemoji-picker-final'

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const accStore = useAccountStore();
const isQuoting = ref(false);
const quoteVisible = ref(false);
const isDefaultQuote = ref(false);

const {profileImg, isIgnoreAccount, steemUrl, imgurls, content} = usePost(props.tweet)
const {formatEmojiText} = useTweet()
const {
  contentEl,
  contentRef,
  getBlur,
  onPaste,
  selectEmoji,
  contentInput
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

const preQuote = () => {
  quoteVisible.value = true
};

const userQuote = () => {

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
          :class="tweet.quoted ? 'text-red-ff' : 'text-grey-bd'">
              {{ tweet.quoteCount ?? 0 }}</span>
  </button>
  <el-dialog v-model="quoteVisible" width="700" align-center title="" destroy-on-close>
    <div class="bg-color1C px-5 min-h-40vh sm:min-h-[300px] sm:pt-40px max-h-80vh relative">
      <div class="modal-close-line text-center text-center">
        <button class="w-50px h-6px rounded-full bg-colorA6"
                @click="quoteVisible = false"></button>
      </div>
      <i-ep-close class="modal-close-icon text-colorA6 w-24px h-24px absolute right-20px top-20px"
                  @click="quoteVisible = false"/>
      <div class="flex-1 overflow-hidden py-20px flex">
        <img class="mr-10px md:mr-1rem rounded-full gradient-border w-40px h-40px"
             :src="headerProfileImg()" alt=""/>
        <div class="flex-1 overflow-x-hidden flex flex-col">
          <div class="flex flex-col relative max-h-30vh overflow-auto">
            <div
                contenteditable
                class="z-1 flex-1 pt-5px whitespace-pre-line leading-24px 2xl:leading-18px content-input-box break-word"
                ref="contentRef"
                @blur="getBlur"
                @paste="onPaste"
                @input="contentInput"
                v-html="formatEmojiText(contentRef)"
            ></div>
          </div>
          <div class="mt-1rem border-1 border-color2A bg-color1C rounded-12px p-15px">
            <div class="flex items-center flex-wrap">
              <img class="rounded-full gradient-border w-1.6rem h-1.6rem mr-5px min-w-1.6rem"
                   :src="profileImg" alt=""/>
              <div class="flex items-center flex-wrap">
                  <span class="c-text-black text-left mr-3 cursor-pointer text-14px leading-18px">
                    {{ tweet.twitterName }}
                  </span>
              </div>
              <div class="flex items-center id-time">
                  <span class="text-sm leading-18px text-grey-bd">
                    @{{ tweet.twitterUsername }}
                  </span>
                <span class="mx-4px text-grey-bd"> · </span>
                <span class="whitespace-nowrap">
                  {{ parseTimestamp(tweet.tweetTime) }}
                </span>
              </div>
            </div>
            <div class="text-left font-400 mt-0.5rem">
              <div class="text-sm leading-18px 2xl:text-14px 2xl:leading-20px text-colorD9 light:text-color46">
                  <span v-if="isIgnoreAccount" class="text-blue-500 break-all">{{steemUrl}}</span>
                <div v-else class="whitespace-pre-line break-word"
                     v-html="formatEmojiText(content)"></div>
              </div>
              <div v-if="imgurls" class="text-colorD9 light:text-color46">
                  <span v-for="(url, index) of imgurls.slice(0, 4)"
                        :key="index" :title="url">[Pic]</span>
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
                        @select="(e: any) => selectEmoji(e)"
                    />
                  </div>
                </template>
              </el-popover>
            </div>
            <button class="h-12 px-3 bg-gradient-primary text-white font-bold rounded-full text-lg
                           flex items-center justify-center gap-2 disabled:opacity-30"
                    :disabled="isQuoting"
                    @click="userQuote">
                <span class="text-white text-h5">
                  {{isDefaultQuote ? $t("curation.tweet") : $t("postView.createNewCuration")}}
                </span>
              <i-ep-loading v-if="isQuoting" class="animate-spin w-18px h-18px text-white"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>

</template>

<style scoped>

</style>
