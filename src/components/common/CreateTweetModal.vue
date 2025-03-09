<script setup lang="ts">
import {useCreateTweet} from "@/composables/useCreateTweet";
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { ref } from "vue";
import { OperateType, useTweet } from "@/composables/useTweet";
import { handleErrorTip, notify } from "@/utils/notify";
import { useCommunityStore } from "@/stores/community";
import emitter from "@/utils/emitter";

const comStore = useCommunityStore()
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
} = useCreateTweet(280 - (comStore.currentSelectedCommunity?.tick.length ?? 0) - 2)

const { preCheckCuration, userTweet } = useTweet();

const tweetLoading = ref(false)

const emit = defineEmits(['close'])

const onPostTweet = async () => {
  try{
    if (leftWordsLength.value < 0){
      return;
    }
    if (tweetLength.value === 0) return;
    tweetLoading.value = true
    if (!(await preCheckCuration(OperateType.TWEET))) {
      return;
    }
    let content = formatElToTextContent(contentRef.value)
    userTweet(content, useCommunityStore().currentSelectedCommunity!.tick!).then(res => {
      emitter.emit('tweeted')
      notify({message: "Tweet success", type: 'success'})
    }).catch(handleErrorTip)

    // await newCommerce(content, useAccountStore().getAccountInfo.twitterId, useCommunityStore().currentSelectedCommunity!.tick!, useCommunityStore().currentSelectedCommunity!.token!)
    emit('close')
  } catch (e) {
    handleErrorTip(e)
  } finally {
    tweetLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-y-6 pb-3">
    <div class="text-xl font-medium text-black text-center">
      {{ $t('postView.tweetOnChain') }}
    </div>
    <div class="flex flex-col gap-y-2 px-4">
    <p class="text-sm text-gray-600">
      {{$t('postView.tweetOnChainTip1')}}
      </p>
    <p v-if="$i18n.locale==='en'" class="text-sm text-gray-600">
      You can write a tweet with
      <span class="text-blue-500">
        #tagai(or @TagAIDAO)
      </span>
       and
      <span class="text-blue-500">
        #{{ useCommunityStore().currentSelectedCommunity?.tick }}
      </span>
      at the front of your tweet content on Twitter, the tweet will be automatically posted to the community.
    </p>
    <p v-if="$i18n.locale==='zh'" class="text-sm text-gray-600">
      您可以在 Twitter 上撰写推文，并在推文内容前面加上
      <span class="text-blue-500">#tagai(or @TagAIDAO)</span> 和
      <span class="text-blue-500">#{{ useCommunityStore().currentSelectedCommunity?.tick }}</span>，
      该推文将自动发布到社区。
    </p>
    <p class="text-sm text-gray-600">
      {{$t('postView.tweetOnChainTip2')}}
    </p>
    </div>
    <div>
      <div class="flex justify-between items-center px-2">
        <div>{{$t('postView.typeTip')}}</div>
        <div :class="leftWordsLength < 0 ? 'text-red-e6' : ''">{{ leftWordsLength }}</div>
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
          {{$t('postView.pleaseInput')}}
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
            <button class="bg-green-normal px-2 h-5 text-sm rounded-md">{{ useCommunityStore().currentSelectedCommunity?.tick }}</button>
            <!-- <button class="bg-grey-light px-2 h-5 text-sm rounded-md">KATC</button> -->
          </div>
        </div>
      </div>
    </div>
    <div class="flex justify-center">
      <button class="px-5 h-11 bg-gradient-primary rounded-full
                       flex justify-center items-center space-x-2 disabled:opacity-30"
              :disabled="tweetLoading"
              @click="onPostTweet">
        <span class="text-white font-bold text-lg">{{$t('postView.goTweet')}}</span>
        <i-ep-loading v-if="tweetLoading" class="text-white animate-spin"/>
      </button>
    </div>
  </div>
</template>

<style scoped>

</style>
