<script setup lang="ts">
import {useModalStore} from "@/stores/common";
import {useCreateTweet} from "@/composables/useCreateTweet";
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { computed, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import debounce from 'lodash.debounce'
import { getSpaceInfoById } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { useSpace, InvalidSpaceCurationType } from "@/composables/useSpace";
import { handleErrorTip, notify } from "@/utils/notify";
import { OperateType, useTweet } from "@/composables/useTweet";
import type { Space } from "@/types";
import i18n from "@/lang";
import emitter from "@/utils/emitter";
const t = i18n.global.t;

const modalStore = useModalStore();
const comStore = useCommunityStore();
const accStore = useAccountStore();
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
} = useCreateTweet(240)

const emit = defineEmits(['close'])

const { getSpaceIdFromUrl, userTweetWithSpace } = useSpace();
const { preCheckCuration } = useTweet();

const invalidSpaceType = ref<InvalidSpaceCurationType>(InvalidSpaceCurationType.OK);

const tweetLoading = ref(false)
const spaceLink = ref('');
const space = ref<Space|null>(null);

const invalidTip = computed(() => {
  if (invalidSpaceType.value !== InvalidSpaceCurationType.OK) {
    switch (invalidSpaceType.value) {
      case InvalidSpaceCurationType.HAS_CREATED:
        return t('community.spaceHasCreated');
      case InvalidSpaceCurationType.INVALID_LINK:
        return t('community.spaceInvalidLink')
      case InvalidSpaceCurationType.NOT_YOUR_SPACE:
        return t('community.spaceNotYours')
      case InvalidSpaceCurationType.SPACE_IS_STARTED:
        return t('community.spaceHasStarted')
      case InvalidSpaceCurationType.SPACE_IS_ENDED:
        return t('community.spaceHasEnded')
    }
  }
})

const onPostTweet = async () => {
  try{
    tweetLoading.value = true
    invalidSpaceType.value = InvalidSpaceCurationType.OK;
    const tweetContent = formatElToTextContent(contentRef.value)
    if (tweetLength.value == 0 || leftWordsLength.value < 0) {
      return;
    }
    if (!(await preCheckCuration(OperateType.TWEET))) {
      return;
    }
    const spaceId = getSpaceIdFromUrl(spaceLink.value);
    if (!spaceId) {
      invalidSpaceType.value = InvalidSpaceCurationType.INVALID_LINK
      return
    }
    const res: any = await getSpaceInfoById(accStore.getAccountInfo.twitterId, spaceId);
    if (!res) {
      invalidSpaceType.value = InvalidSpaceCurationType.INVALID_LINK
    }
    space.value = res;
    if (space.value!.tweetId){
      invalidSpaceType.value = InvalidSpaceCurationType.HAS_CREATED;
      return;
    }
    if (space.value!.state !== 1 && space.value!.state !== 2) {
      invalidSpaceType.value = InvalidSpaceCurationType.SPACE_IS_ENDED
      return;
    }
    if (space.value!.twitterId != accStore.getAccountInfo.twitterId) {
      invalidSpaceType.value = InvalidSpaceCurationType.NOT_YOUR_SPACE
      return;
    }
    await userTweetWithSpace(`${tweetContent}\n${spaceLink.value}`, comStore.currentSelectedCommunity!.tick, spaceId)
    emitter.emit('tweeted')
    notify({message: 'Tweet success', type: 'success'})
    emit('close')
  } catch (e) {
    console.log(e);
    handleErrorTip(e);
  } finally {
    tweetLoading.value = false
  }
}

const checkSpace = debounce(async () => {

}, 10000)
</script>

<template>
  <div class="flex flex-col gap-y-6 pb-3">
    <div class="text-xl font-medium text-black text-center">
      {{ $t('postView.spaceOnChain') }}
    </div>
    <div>
      <div class="flex justify-between items-center px-2">
        <div>{{ $t('postView.typeTip') }}</div>
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
          {{ $t('postView.pleaseInput') }}
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
            <button class="bg-green-normal px-2 h-5 text-sm rounded-md">{{ comStore.currentSelectedCommunity?.tick }}</button>
          </div>
        </div>
      </div>
      <div class="mt-4">{{ $t('postView.spaceLink') }}</div>
      <div class="bg-grey-f0/90 rounded-2xl h-12 px-3">
        <input v-model="spaceLink" @input="checkSpace" class="bg-transparent outline-none h-full w-full" type="text">
      </div>
    </div>
    <div class="flex justify-center">
      <button class="px-5 h-11 bg-gradient-primary rounded-full
                       flex justify-center items-center space-x-2 disabled:opacity-30"
              :disabled="tweetLoading"
              @click="onPostTweet">
        <span class="text-white font-bold text-lg">{{ $t('postView.goTweet') }}</span>
        <i-ep-loading v-if="tweetLoading" class="text-white animate-spin"/>
      </button>
    </div>
    <div v-if="invalidSpaceType !== InvalidSpaceCurationType.OK" class="text-red-ff text-center">
      {{ invalidTip }}
    </div>
  </div>
</template>

<style scoped>

</style>
