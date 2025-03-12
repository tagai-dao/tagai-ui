<script setup lang="ts">
import { useModalStore } from "@/stores/common";
import { useCreateTweet } from "@/composables/useCreateTweet";
import { EmojiPicker } from "vue3-twemoji-picker-final";
import { computed, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import debounce from "lodash.debounce";
import { getSpaceInfoById, getTweetById } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip, notify } from "@/utils/notify";
import { OperateType, useTweet } from "@/composables/useTweet";
import type { Tweet } from "@/types";
import i18n from "@/lang";
import emitter from "@/utils/emitter";
import { useTools } from "@/composables/useTools";
const t = i18n.global.t;

const modalStore = useModalStore();
const comStore = useCommunityStore();
const accStore = useAccountStore();
const {onCopy} = useTools()

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
  formatElToTextContent,
} = useCreateTweet(220);

const emit = defineEmits(["close"]);

const { preCheckCuration, getTweetIdFromUrl } = useTweet();

const tweetLoading = ref(false);
const tweetLink = ref("");
const tweet = ref<Tweet | null>(null);

const invalidTip = ref('')

const onPostTweet = async () => {
  try {
    tweetLoading.value = true;
    invalidTip.value = ''
    const tweetContent = formatElToTextContent(contentRef.value);
    if (tweetLength.value == 0 || leftWordsLength.value < 0) {
      return;
    }
    const tweetId = getTweetIdFromUrl(tweetLink.value);
    if (!tweetId) {
      invalidTip.value = 'Invalid tweet link'
      return;
    }
    const res: any = await getTweetById(accStore.getAccountInfo.twitterId, tweetId);
    if (res) {
      tweet.value = res;
    }

    if (!(await preCheckCuration(OperateType.CURATE), tweet.value, 10)) {
      return;
    }

    notify({ message: "Tweet success", type: "success" });
    emit("close");
  } catch (e) {
    console.log(e);
    handleErrorTip(e);
  } finally {
    tweetLoading.value = false;
  }
};

const checkSpace = debounce(async () => {}, 10000);
</script>

<template>
  <div class="flex flex-col gap-y-6 pb-3">
    <template v-if="$i18n.locale==='en'">
      <div class="text-xl font-medium text-black text-center">
        Tip ${{ comStore.currentSelectedCommunity?.tick }}<br />
      </div>
      <div class="flex flex-col gap-y-2 px-4 text-sm">
        <p class="text-sm text-gray-600">
          Tip ${{ comStore.currentSelectedCommunity?.tick }} to an awesome people by reply
          to one of his tweets.
        </p>
        <p class="text-sm text-gray-600">
          You can reply the tweet which you like with the following content:
        </p>
        <span class="text-sm text-blue-500 flex items-center">
        @TagAIDAO tip ${{ comStore.currentSelectedCommunity?.tick }}
        <button class="ml-2" @click="onCopy(`@TagAIDAO tip $${ comStore.currentSelectedCommunity?.tick }`)">
            <img class="w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
      </span>
        in the front of your reply content on Twitter directly, and append with any words you want to say else.
        <p class="text-sm text-gray-600">
          It will automatically curate the tweet with 10 VPs and cost 200 OPs from your account.
        </p>
      </div>
    </template>
    <template v-if="$i18n.locale==='zh'">
      <div class="text-xl font-medium text-black text-center">
        打赏 ${{ comStore.currentSelectedCommunity?.tick }}<br />
      </div>
      <div class="flex flex-col gap-y-2 px-4 text-sm">
        <p class="text-sm text-gray-600">
          回复推文并打赏 ${{ comStore.currentSelectedCommunity?.tick }}
        </p>
        <p class="text-sm text-grey-normal">
          你可以回复你喜欢的推文，并在回复内容前加上以下内容：
        </p>
        <span class="text-sm text-blue-500 flex items-center">
          @TagAIDAO tip ${{ comStore.currentSelectedCommunity?.tick }}
        <button class="ml-2" @click="onCopy(`@TagAIDAO tip $${ comStore.currentSelectedCommunity?.tick }`)">
            <img class="w-[10px]" src="~@/assets/icons/icon-copy.svg" alt="">
          </button>
        </span>
        <p class="text-sm text-grey-normal">
          这将自动为推文提供10个VP，并从您的帐户中扣除200个OP，如果原推文没有进入社区内容池，则会消耗400个OP。
        </p>
      </div>
    </template>
    <!-- <div>
      <div class="p-2">original tweet link</div>
      <div class="bg-grey-f0/90 rounded-2xl h-12 px-3">
        <input
          v-model="tweetLink"
          @input="checkSpace"
          placeholder="Original tweet link"
          class="bg-transparent outline-none h-full w-full"
          type="text"
        />
      </div>
      <div
        v-if="invalidTip"
        class="text-red-ff text-center"
      >
        {{ invalidTip }}
      </div>
      <div class="flex justify-between items-center p-2">
        <div>Type your content here to reply the tweet</div>
        <div :class="leftWordsLength < 0 ? 'text-red' : ''">{{ leftWordsLength }}</div>
      </div>
      <div
        class="max-h-[176px] overflow-hidden relative flex flex-col bg-grey-f0/90 rounded-2xl"
      >
        <div
          contenteditable
          class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] px-3 pt-2 whitespace-pre-line text-lg z-10 relative"
          ref="contentRef"
          @input="contentInput"
          @blur="getBlur"
          @paste="onPaste"
          v-html="contentEl"
        ></div>
        <div
          v-if="!showClear"
          class="absolute top-3 left-3 text-14px leading-24px z-0 opacity-30"
        >
          Please input
        </div>
        <div class="flex justify-between items-center px-3 py-2">
          <el-popover
            ref="emojiPopover"
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
              <div class="h-[310px] lg:h-[400px]">
                <EmojiPicker
                  :options="{
                    imgSrc: '/emoji/',
                    locals: 'en',
                    hasSkinTones: false,
                    hasGroupIcons: false,
                  }"
                  @select="(e: any) => selectEmoji(e)"
                />
              </div>
            </template>
          </el-popover>
          <div class="font-extralight flex flex-wrap gap-2 mt-2">
            <button class="bg-green-normal px-2 h-5 text-sm rounded-md">
              {{ comStore.currentSelectedCommunity?.tick }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="flex justify-center">
      <button
        class="px-5 h-11 bg-gradient-primary rounded-full flex justify-center items-center space-x-2 disabled:opacity-30"
        :disabled="tweetLoading"
        @click="onPostTweet"
      >
        <span class="text-white font-bold text-lg">Go Reply</span>
        <i-ep-loading v-if="tweetLoading" class="text-white animate-spin" />
      </button>
    </div> -->
  </div>
</template>

<style scoped></style>
