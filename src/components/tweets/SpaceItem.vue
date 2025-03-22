<script setup lang="ts">
import {computed, onMounted, type PropType, ref} from 'vue'
import { formatPrice, parseTimestamp } from '@/utils/helper';
import UserAvatar from "@/components/common/UserAvatar.vue";
import {useTweet} from "@/composables/useTweet";
import TweetSpaceCard from "@/components/tweets/TweetSpaceCard.vue";
import {usePost} from "@/composables/usePost";
import type {Tweet} from "@/types";
import { useStateStore } from '@/stores/common';

const props = defineProps({
  tweet: {type: Object as PropType<Tweet>, required: true,},
  multiline: {type: Boolean, required: false}
})

const {formatEmojiText} = useTweet()
const {
  blogRef,
  profileImg,
  content,
  isIgnoreAccount,
  steemUrl,
  replaceEmptyImg,
  gotoTweet,
  clickContent,
} = usePost(props.tweet)

const showPageInfo = computed(() => {
  if (props.tweet.pageInfo && props.tweet.pageInfo.length > 10) {
    try {
      const page = JSON.parse(props.tweet.pageInfo)
      if (page && page.url && page.url.startsWith(`https://${window.document.location.host}`)) {
        return false
      }
    } catch (e) {

    }
    return true
  }
})

const onUserAvatar = () => {

}
</script>

<template>
  <div ref="blogRef">
    <div class="bg-gray-fc rounded-2xl py-4 px-3">
      <div class="flex gap-2 items-stretch">
        <UserAvatar
          :profile-img="profileImg"
          :name="tweet.twitterName"
          :username="tweet.twitterUsername"
          :followers="tweet.followers"
          :followings="tweet.followings"
          :eth-addr="tweet.ethAddr"
          :steem-id="tweet.steemId"
          :teleported="true"
          :credit="tweet.credit"
        >
          <template #avatar-img>
            <img
              v-if="profileImg"
              class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              @error="replaceEmptyImg"
              :src="profileImg"
              alt=""
            />
            <img
              v-else
              class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
              @click.stop="onUserAvatar"
              src="~@/assets/icons/icon-default-avatar.svg"
              alt=""
            />
          </template>
        </UserAvatar>
        <div class="flex-1">
          <div class="w-full flex items-center flex-wrap gap-x-2">
            <a class="font-bold text-lg" @click.stop="onUserAvatar()">{{
              tweet.twitterName
            }}</a>
            <span class="mx-4px"> · </span>
            <button @click="gotoTweet($event)">
              <img class="w-4 h-4" src="~@/assets/icons/icon-x.svg" alt="" />
            </button>
          </div>
          <div class="text-sm italic text-grey-bd flex flex-wrap gap-x-4 gap-y-1">
            <span>@{{ tweet.twitterUsername }}</span>
            <span>{{ parseTimestamp(tweet.tweetTime) }}</span>
          </div>
        </div>
        <el-popover
          v-if="tweet.amount"
          popper-class="c-arrow-popper rounded-sm"
          trigger="click"
          width="130"
          :teleported="true"
          :persistent="false"
        >
          <template #reference>
            <button
              @click.stop
              class="h-6 rounded-full px-3 text-white text-sm font-semibold"
              :class="tweet.isSettled ? 'bg-grey-light-active' : 'bg-gradient-primary'"
            >
              {{
                formatPrice(
                  (tweet.price ?? 0) * useStateStore().ethPrice * (tweet.amount ?? 0)
                )
              }}
            </button>
          </template>
          <template #default>
            <div class="text-grey-normal text-sm px-2">
              <div class="flex justify-between items-center h-7">
                <span>{{$t('postView.author')}}</span>
                <span class="font-semibold">{{
                  formatPrice(
                    (tweet.authorAmount ?? 0) *
                      (tweet.price ?? 0) *
                      useStateStore().ethPrice
                  )
                }}</span>
              </div>
              <div
                class="flex justify-between items-center h-7 border-t-[0.5px] border-b-[0.5px] border-grey-6f/10"
              >
                <span>{{ $t('postView.curator') }}</span>
                <span class="font-semibold">{{
                  formatPrice(
                    ( (tweet.curateAmount ?? 0)) *
                      (tweet.price ?? 0) *
                      useStateStore().ethPrice
                  )
                }}</span>
              </div>
              <div class="flex justify-between items-center h-7 border-t-[0.5px] border-b-[0.5px] border-grey-6f/10">
                <span>{{$t('postView.host')}}</span>
                <span class="font-semibold">{{ formatPrice(((tweet.hostAmount ?? 0)) * (tweet.price ?? 0) * useStateStore().ethPrice) }}</span>
              </div>
              <div class="flex justify-between items-center h-7 border-t-[0.5px] border-b-[0.5px] border-grey-6f/10">
                <span>{{$t('postView.co-host')}}</span>
                <span class="font-semibold">{{ formatPrice(((tweet.cohostAmount ?? 0)) * (tweet.price ?? 0) * useStateStore().ethPrice) }}</span>
              </div>
              <div class="flex justify-between items-center h-7 border-t-[0.5px] border-b-[0.5px] border-grey-6f/10">
                <span>{{$t('postView.speaker')}}</span>
                <span class="font-semibold">{{ formatPrice(((tweet.speakerAmount ?? 0)) * (tweet.price ?? 0) * useStateStore().ethPrice) }}</span>
              </div>
              <div class="flex justify-between items-center h-7">
                <span>{{$t('postView.endTime')}}:</span>
                <span class="font-semibold">
                  {{ tweet.listed ? parseTimestamp((tweet.dayNumber % 7 + 3 + tweet.dayNumber) * 86400000) : $t('postView.pendingList') }}
                </span>
              </div>
            </div>
          </template>
        </el-popover>
      </div>
      <div class="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
        <div
          @click.stop="clickContent"
          class="cursor-pointer text-base xl:text-lg tracking-0.2 pl-12"
        >
          <a
            v-if="isIgnoreAccount"
            :href="steemUrl"
            class="text-blue-500 break-all"
            target="_blank"
            >{{ "" }}</a
          >
          <div
            class="whitespace-pre-line break-words content" :class="multiline ? '' : 'multi-content-3'"
            v-else
            v-html="formatEmojiText(content)"
          ></div>
        </div>
        <div class="px-3 md:pl-12">
          <TweetSpaceCard v-if="tweet.spaceId" :tweet="tweet" />
          <slot name="tweet-mint"></slot>
          <slot name="tweet-action-bar"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
