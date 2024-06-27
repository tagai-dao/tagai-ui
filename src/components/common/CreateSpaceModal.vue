<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {useCreateTweet} from "@/composables/useCreateTweet";
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import {onUnmounted, ref, watch} from "vue";

const modalStore = useModalStore()
const {
  contentRef,
  showClear,
  contentEl,
  leftWordsLength,
  contentInput,
  getBlur,
  onPaste,
  selectEmoji,
  formatElToTextContent
} = useCreateTweet()

const tweetLoading = ref(false)
const onPostTweet = () => {
  tweetLoading.value = true
  const tweetContent = formatElToTextContent(contentRef.value)
}
</script>

<template>
  <div class="flex flex-col gap-y-6 pb-3">
    <div class="text-xl font-medium text-black text-center">
      Tweet an onchain Space
    </div>
    <div>
      <div class="flex justify-between items-center px-2">
        <div>Type your content here</div>
        <div :class="leftWordsLength < 0 ? 'text-red' : ''">{{ leftWordsLength }}</div>
      </div>
      <div class="max-h-[176px] overflow-hidden relative flex flex-col bg-grey-f0/90 rounded-2xl">
        <div contenteditable
             class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] px-3 pt-2 whitespace-pre-line
                      text-lg z-10 relative"
             ref="contentRef"
             @input="contentInput"
             @blur="getBlur"
             @paste="onPaste"
             v-html="contentEl"></div>
        <div v-if="!showClear" class="absolute top-3 left-3 text-14px leading-24px z-0 opacity-30">
          Please input
        </div>
        <div class="flex justify-between items-center px-3 py-2">
          <el-popover ref="emojiPopover" trigger="click" width="300" :teleported="true" :persistent="false">
            <template #reference>
              <img
                  class="w-1.8rem h-1.8rem lg:w-1.4rem lg:h-1.4rem"
                  src="~@/assets/icons/icon-emoji.svg"
                  alt=""
              />
            </template>
            <template #default>
              <div class="h-[310px] lg:h-[400px]">
                <EmojiPicker :options="{ imgSrc: '/emoji/', locals: 'en',hasSkinTones: false, hasGroupIcons: false}"
                             @select="(e: any) => selectEmoji(e)"/>
              </div>
            </template>
          </el-popover>
          <div class="font-extralight flex flex-wrap gap-2 mt-2">
            <button class="bg-green-b6 px-2 h-5 text-sm rounded-md">onchain</button>
            <button class="bg-grey-light px-2 h-5 text-sm rounded-md">KATC</button>
          </div>
        </div>
      </div>
      <div class="mt-4">Space Link</div>
      <div class="bg-grey-normal-active/90 rounded-2xl h-12 px-3">
        <input class="bg-transparent outline-none h-full w-full" type="text">
      </div>
    </div>
    <div class="flex justify-center">
      <button class="w-min px-5 h-11 bg-gradient-primary rounded-full
                       flex justify-center items-center space-x-2 disabled:opacity-30"
              :disabled="tweetLoading"
              @click="onPostTweet">
        <span class="text-white font-bold text-lg">GoTweet</span>
        <i-ep-loading v-if="tweetLoading" class="text-white animate-spin"/>
      </button>
    </div>
    <div class="text-sm text-grey-normal text-center">
      Credit 排名 10/30 的用户点赞/转发此推文，<br>
      该 Space 参与者可获得 $LATC 奖励。
    </div>
  </div>
</template>

<style scoped>

</style>
