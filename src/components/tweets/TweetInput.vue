<script setup lang="ts">
import {useCreateTweet} from "@/composables/useCreateTweet";
import {ref} from "vue";
import { EmojiPicker } from 'vue3-twemoji-picker-final'

const props = defineProps(['maxLength', 'tick'])
const {
  contentRef,
  showClear,
  contentEl,
  leftWordsLength,
  tweetLength,
  contentInput,
  getBlur,
  onPaste,
  selectEmoji,
  formatElToTextContent
} = useCreateTweet(props.maxLength)

const tweetLoading = ref(false)
const onPostTweet = () => {
  tweetLoading.value = true
  const tweetContent = formatElToTextContent(contentRef.value)
}

defineExpose({contentEl, contentRef, leftWordsLength, tweetLength, formatElToTextContent})
</script>

<template>
  <div>
    <div class="flex justify-between items-center px-2">
      <div></div>
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
        <slot name="placeholder"></slot>
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
        <div v-if="tick" class="font-extralight flex flex-wrap gap-2 mt-2">
          <button class="bg-green-normal px-2 h-5 text-sm rounded-md">{{ tick }}</button>
          <!-- <button class="bg-grey-light px-2 h-5 text-sm rounded-md">KATC</button> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
